"""Verify synthetic QA documents after qa-print.cjs and qa-print-long.cjs.
Rendered-page review is still required; text checks alone cannot prove layout.
"""
from pathlib import Path
import re
from pypdf import PdfReader

root = Path(__file__).resolve().parent.parent / 'output' / 'pdf'
expected = {f'SYN-{key}-{n:02}' for key, count in [('budget',12),('standard',12),('premium',40)] for n in range(1,count+1)}
for kind in ['customer', 'internal']:
    normal = PdfReader(root / f'{kind}-quote-qa.pdf')
    assert len(normal.pages) == 1, f'{kind}: standard quote should remain one page'
    normal_text = '\n'.join(page.extract_text() for page in normal.pages)
    long = PdfReader(root / f'long-{kind}-quote-qa.pdf')
    text = '\n'.join(page.extract_text() for page in long.pages)
    markers = re.findall(r'SYN-(?:budget|standard|premium)-[0-9]{2}', text)
    assert set(markers) == expected and len(markers) == 64, 'Missing or duplicated inclusion marker'
    assert all(page.extract_text().strip() for page in long.pages), 'Blank long-quote page'
    assert all(any(name in page.extract_text() for name in ['Budget','Standard','Premium']) for page in long.pages), 'Continuation needs a tier heading'
    for copy in [normal_text, text]:
        assert ('Internal copy' in copy) == (kind == 'internal'), 'Customer/internal privacy separation failed'
        assert 'Estimate costs' not in copy and 'Checking editing access' not in copy, 'Editor chrome leaked into PDF'
    print(f'PASS {kind}: default one-page output, complete 64-marker long quote, repeated tier context and privacy separation')
