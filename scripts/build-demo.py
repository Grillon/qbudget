#!/usr/bin/env python3
"""Construit la démo HTML à partir des fixtures de tests (sans données bancaires privées)."""
import argparse
import json
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def target_content():
    fixtures=ROOT / 'tests' / 'fixtures'
    csv=(fixtures / 'life_2026_operations.csv').read_text(encoding='utf-8')
    annotations=json.loads((fixtures / 'life_2026_annotations.json').read_text(encoding='utf-8'))
    dataset={'csv':csv, 'annotations':annotations, 'asof':'2026-10-25', 'until':'2026-11-30'}
    return ('// Démo synthétique générée par scripts/build-demo.py (source : fixtures des tests).\n'
            '(function(root){"use strict";root.QBudgetDemo=' + json.dumps(dataset,ensure_ascii=False,separators=(',',':')) + ';})(typeof globalThis!=="undefined"?globalThis:this);\n')
if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    target=ROOT/'src'/'demo.js'
    content=target_content()
    if args.check:
        if not target.exists() or target.read_text(encoding='utf-8')!=content:
            print('ERREUR : src/demo.js désynchronisé des fixtures des tests',file=sys.stderr)
            sys.exit(1)
        print('Démonstration et fixtures cohérentes')
    else:
        target.write_text(content,encoding='utf-8')
        print('Démonstration synchronisée')
