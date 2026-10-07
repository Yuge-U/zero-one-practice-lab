from pathlib import Path # 承認済みPRACTICE画像と出力先を扱います。
from PIL import Image # 承認済み画像を高品質に縮小します。
import hashlib # 承認済み原版の一致を検証します。
root=Path(__file__).resolve().parent # productionフォルダを基準にします。
source=root/'brand'/'practice-master.png' # 承認済みPRACTICEアイコン原版です。
raw=source.read_bytes() # 変換前の原版バイトを読みます。
assert hashlib.sha256(raw).hexdigest()=='0775d9cff2d939c63177715415b10029c85e5113725331a069a9233a50d90e73' # 承認済み原版以外ではビルドを停止します。
image=Image.open(source).convert('RGB') # WebP原版をRGBへ統一します。
assert image.width==image.height and image.width>=1024 # 正方形かつ十分な解像度を必須にします。
image.resize((512,512),Image.Resampling.LANCZOS).save(root/'icons'/'icon-512.webp','WEBP',quality=96,method=6) # PWA用512pxを生成します。
image.resize((192,192),Image.Resampling.LANCZOS).save(root/'icons'/'icon-192.webp','WEBP',quality=96,method=6) # PWA用192pxを生成します。
print('Approved PRACTICE icon',len(raw),hashlib.sha256(raw).hexdigest()) # 実際に使った原版を証拠へ出します。

# Separate, versioned browser-tab artwork; legacy BMP entries work without WebP support.
image.convert('RGBA').save(root/'icons'/'favicon-practice-20261007f.ico', format='ICO', sizes=[(16,16),(32,32),(48,48)], bitmap_format='bmp')
(root/'icons'/'favicon.ico').write_bytes((root/'icons'/'favicon-practice-20261007f.ico').read_bytes())
image.resize((32,32),Image.Resampling.LANCZOS).save(root/'icons'/'favicon-practice-32-20261007f.png', 'PNG')

for size in (180,192):
    image.resize((size,size),Image.Resampling.LANCZOS).save(root/"icons"/f"safari-practice-{size}-20261007g.png", "PNG")

for name in ('apple-touch-practice-180-20261007k.png','apple-touch-icon.png','apple-touch-icon-precomposed.png'):
    (root/'icons'/name).write_bytes((root/'icons'/'safari-practice-180-20261007g.png').read_bytes())
