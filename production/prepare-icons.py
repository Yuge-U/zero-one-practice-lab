from pathlib import Path
import hashlib
root = Path(__file__).resolve().parent / 'icons'
# Common bookmark artwork is generated directly from the supplied native JPEG.
source = (root / 'apple-touch-zero-one-180-20261007m.png').read_bytes()
assert hashlib.sha256(source).hexdigest() == '2a67fb30e4d25670d28f9517dad80525f1bd44f1081147e3586e5b58725b2f1e'
for name in ('apple-touch-icon.png', 'apple-touch-icon-precomposed.png'):
    (root / name).write_bytes(source)
print('Common Apple bookmark icon', len(source), hashlib.sha256(source).hexdigest())
