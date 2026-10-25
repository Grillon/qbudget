#!/usr/bin/env python3
"""Importer des relevés CSV bancaires avec banques.json (Python standard uniquement).

Usage : python3 import_releves.py bourso.csv bps.csv revolut.csv -o operations.csv
"""
import argparse
import copy
import csv
import hashlib
import io
import json
import re
import sys
from collections import Counter
from datetime import datetime
from decimal import Decimal
from pathlib import Path

FIELDS = ['id', 'banque', 'compte', 'date', 'date_valeur', 'description', 'montant',
          'devise', 'solde', 'categorie', 'sous_categorie', 'statut', 'source', 'doublon_potentiel']
SIGNATURE_FIELDS = ('banque', 'compte', 'date', 'date_valeur', 'description',
                    'montant', 'devise', 'solde', 'statut')


def clean(value):
    return (value or '').strip().lstrip('\ufeff')


def parse_number(value, separator):
    value = clean(value).replace('\u00a0', '').replace('\u202f', '').replace(' ', '').replace("'", '')
    if not value:
        return ''
    if separator == ',':
        value = value.replace('.', '').replace(',', '.')
    elif separator == '.':
        value = value.replace(',', '')
    else:
        raise ValueError(f'séparateur décimal incorrect : {separator!r}')
    if not re.fullmatch(r'[+-]?(?:\d+(?:\.\d+)?|\.\d+)', value):
        raise ValueError(f'montant invalide : {value!r}')
    return format(Decimal(value), 'f')


def parse_date(value, fmt):
    value = clean(value)
    if not value:
        return ''
    if fmt == '%Y-%m-%d' and len(value) > 10:
        value = value[:10]
    try:
        return datetime.strptime(value, fmt).date().isoformat()
    except ValueError as e:
        raise ValueError(f'date invalide {value!r}, attendu {fmt}') from e


def select(values, headers, selector):
    """Sélecteur : nom, noms alternatifs, ou {colonne, occurrence (1-based)}."""
    if selector is None:
        return ''
    if isinstance(selector, list):
        return next((v for s in selector if (v := select(values, headers, s))), '')
    if isinstance(selector, str):
        selector = {'colonne': selector}
    name = selector['colonne']
    occurrence = selector.get('occurrence', 1)
    positions = [i for i, h in enumerate(headers) if h == name]
    if len(positions) < occurrence:
        raise ValueError(f'colonne absente : {name!r} (occurrence {occurrence})')
    return clean(values[positions[occurrence - 1]])


def extract(values, headers, config):
    maps = config['champs']
    result = dict.fromkeys(FIELDS, '')
    result['banque'] = config['nom']
    for field in ('compte', 'description', 'categorie', 'sous_categorie', 'statut', 'devise'):
        if field in maps:
            result[field] = select(values, headers, maps[field])
    for field in ('date', 'date_valeur'):
        if field in maps:
            result[field] = parse_date(select(values, headers, maps[field]), config['format_date'])
    for field in ('montant', 'solde'):
        if field in maps:
            spec = maps[field]
            sep = spec.get('decimal', config.get('decimal', '.')) if isinstance(spec, dict) else config.get('decimal', '.')
            result[field] = parse_number(select(values, headers, spec), sep)
    if 'debit' in maps and 'credit' in maps:
        sep = config.get('decimal', '.')
        debit = Decimal(parse_number(select(values, headers, maps['debit']), sep) or '0')
        credit = Decimal(parse_number(select(values, headers, maps['credit']), sep) or '0')
        # Le champ Débit décrit une sortie, qu'il soit signé ou non dans l'export.
        result['montant'] = format(credit - abs(debit), 'f')
    result['devise'] = config.get('devise_fixe', result['devise'])
    if not result['date']:
        raise ValueError('date manquante')
    if not result['montant']:
        raise ValueError('montant manquant')
    return result


def detect(headers, configs, delimiter):
    matches = []
    counts = Counter(headers)
    for cfg in configs:
        if cfg['separateur'] != delimiter:
            continue
        if not all(counts[name] >= 1 for name in cfg['colonnes_requises']):
            continue
        if not all(counts[name] >= minimum for name, minimum in cfg.get('occurrences_requises', {}).items()):
            continue
        matches.append(cfg)
    if len(matches) != 1:
        raise ValueError(f'format non reconnu ou ambigu ({len(matches)} configurations compatibles)')
    return matches[0]


def read_file(path, configs):
    raw = path.read_bytes()
    for enc in ('utf-8-sig', 'cp1252'):
        try:
            content = raw.decode(enc)
            break
        except UnicodeDecodeError:
            pass
    else:
        raise ValueError('encodage CSV non reconnu')
    header_line = next((line for line in content.splitlines() if line.strip()), '')
    delimiter = ';' if header_line.count(';') > header_line.count(',') else ','
    reader = csv.reader(io.StringIO(content, newline=''), delimiter=delimiter)
    headers = [clean(h) for h in next(reader)]
    config = detect(headers, configs, delimiter)
    items, errors = [], []
    for line_no, values in enumerate(reader, start=2):
        if not values or not any(clean(x) for x in values):
            continue
        try:
            if len(values) != len(headers):
                raise ValueError(f'{len(values)} colonnes au lieu de {len(headers)}')
            item = extract(values, headers, config)
            item['source'] = path.name
            item['_ligne'] = line_no
            signature = '\x1f'.join(item[k] for k in SIGNATURE_FIELDS)
            item['_signature'] = hashlib.sha256(signature.encode()).hexdigest()
            items.append(item)
        except (KeyError, ValueError) as exc:
            errors.append(f'{path.name}: ligne {line_no}: {exc}')
    return config['nom'], items, errors



def prepare_output(config):
    """Valide la description de sortie et retourne les colonnes sélectionnées."""
    spec = config.get('sortie', {})
    delim = spec.get('separateur', ';')
    if not isinstance(delim, str) or len(delim) != 1 or delim in ('\n', '\r', '"'):
        raise ValueError('sortie.separateur doit être un caractère valide')
    decimal = spec.get('decimal', '.')
    if decimal not in ('.', ','):
        raise ValueError('sortie.decimal doit être "." ou ","')
    cols = spec.get('colonnes', FIELDS)
    if not isinstance(cols, list) or not cols:
        raise ValueError('sortie.colonnes doit être une liste non vide')
    fields, names = [], []
    for col in cols:
        if isinstance(col, str):
            field, name = col, col
        elif isinstance(col, dict):
            field, name = col.get('champ'), col.get('nom')
        else:
            raise ValueError(f'colonne de sortie incorrecte : {col!r}')
        if field not in FIELDS or not isinstance(name, str) or not name.strip():
            raise ValueError(f'colonne de sortie inconnue ou nom invalide : {col!r}')
        fields.append(field)
        names.append(name)
    if len(set(names)) != len(names):
        raise ValueError('les noms de colonnes de sortie doivent être uniques')
    return fields, names, delim, decimal


def render_output(row, fields, decimal):
    result = []
    for field in fields:
        value = row[field]
        if field in ('montant', 'solde') and value and decimal == ',':
            value = value.replace('.', ',')
        result.append(value)
    return result


def importer_version():
    """Version de la distribution qbudget qui embarque cet importateur."""
    try:
        return json.loads(Path(__file__).with_name('package.json').read_text(encoding='utf-8'))['version']
    except (OSError, KeyError, ValueError):
        return 'inconnue (script indépendant)'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', action='version', version=f'%(prog)s {importer_version()}')
    parser.add_argument('fichiers', nargs='+', type=Path)
    parser.add_argument('-o', '--output', type=Path, default=Path('operations_normalisees.csv'))
    parser.add_argument('-c', '--config', type=Path, default=Path(__file__).with_name('banques.json'))
    args = parser.parse_args()
    try:
        settings = json.loads(args.config.read_text(encoding='utf-8'))
        configs = settings['banques']
        fields, names, output_delimiter, output_decimal = prepare_output(settings)
    except (OSError, ValueError, KeyError) as exc:
        print(f'Configuration invalide : {exc}', file=sys.stderr)
        return 1
    rows, errors, groups = [], [], {}
    for path in args.fichiers:
        try:
            bank, items, issues = read_file(path, configs)
            errors.extend(issues)
            for item in items:
                sig = item.pop('_signature')
                item['id'] = hashlib.sha256(f'{sig}\x1f{path.name}\x1f{item.pop("_ligne")}'.encode()).hexdigest()[:20]
                groups.setdefault(sig, []).append(item)
                rows.append(item)
            print(f'{bank}: {path.name}: {len(items)} opérations lues')
        except (OSError, ValueError, StopIteration) as exc:
            errors.append(f'{path}: {exc}')
    if errors:
        print('Erreurs détectées (aucun fichier écrit) :', file=sys.stderr)
        for error in errors:
            print(f' - {error}', file=sys.stderr)
        return 1
    for group in groups.values():
        if len(group) > 1:
            for item in group:
                item['doublon_potentiel'] = 'oui'
    rows.sort(key=lambda r: (r['date'], r['banque'], r['id']))
    with args.output.open('w', encoding='utf-8', newline='') as handle:
        writer = csv.writer(handle, delimiter=output_delimiter)
        writer.writerow(names)
        writer.writerows(render_output(row, fields, output_decimal) for row in rows)
    print(f'OK : {len(rows)} opérations, {sum(x["doublon_potentiel"] == "oui" for x in rows)} signalées, sortie : {args.output}')
    return 0

if __name__ == '__main__':
    sys.exit(main())
