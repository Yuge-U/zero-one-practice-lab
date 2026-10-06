from pathlib import Path # ZERO ONE PRACTICEの原版と出力先を扱います。
from PIL import Image # SVGから生成済みPNGをWebPへ変換します。
import cairosvg # SVG原版を高品質なPNGへ描画します。
root=Path(__file__).resolve().parent # productionフォルダを基準にします。
svg=root/'practice-icon.svg' # ZERO ONE PRACTICEの正式原版です。
png=root/'icons'/'practice-source.png' # 一時的な高解像度描画です。
cairosvg.svg2png(bytestring=svg.read_bytes(),write_to=str(png),output_width=512,output_height=512) # 512pxで描画します。
image=Image.open(png).convert('RGB') # WebP用RGB画像へ統一します。
image.resize((512,512),Image.Resampling.LANCZOS).save(root/'icons'/'icon-512.webp','WEBP',quality=96,method=6) # PWA用512pxを生成します。
image.resize((192,192),Image.Resampling.LANCZOS).save(root/'icons'/'icon-192.webp','WEBP',quality=96,method=6) # PWA用192pxを生成します。
png.unlink() # 一時PNGを残しません。
