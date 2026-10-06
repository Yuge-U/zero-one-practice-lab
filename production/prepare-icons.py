from pathlib import Path # 承認済み画像と変換結果の場所を指定します。
from PIL import Image # 画像の再描画をせず寸法だけを変換します。
import hashlib, struct, zlib # PNG形式の決定的なバイト列を作ります。
root = Path(__file__).resolve().parent / 'icons' # 今回のリリース画像だけを対象にします。
source = (root / 'icon-512.webp').read_bytes() # 転送済みの承認画像を読みます。
assert len(source) > 0 # リリースに同梱した承認済み画像が存在することを確認します。
image = Image.open(root / 'icon-512.webp').convert('RGB').resize((180, 180), Image.Resampling.LANCZOS) # iPhoneのホーム画面用に縮小します。
pixels = image.tobytes() # 原図を保持したRGB値を取り出します。
raw = b''.join(b'\x00' + pixels[row * 540:(row + 1) * 540] for row in range(180)) # PNGの各行に無変換フィルターを付けます。
blocks = [raw[index:index + 65535] for index in range(0, len(raw), 65535)] # 圧縮実装の差に依存しない保存ブロックへ分けます。
stream = b'\x78\x01' + b''.join(bytes([index == len(blocks) - 1]) + struct.pack('<HH', len(block), 65535 - len(block)) + block for index, block in enumerate(blocks)) + struct.pack('>I', zlib.adler32(raw)) # 決定的なPNGの圧縮ストリームを構築します。
def chunk(kind, data): # PNGの各ブロックへ長さと検査値を付けます。
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data)) # 不完全な画像を検出できる形式にします。
result = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 180, 180, 8, 2, 0, 0, 0)) + chunk(b'IDAT', stream) + chunk(b'IEND', b'') # 標準PNGとして結合します。
(root / 'apple-touch-icon.png').write_bytes(result) # ビルド時だけに新しいホーム画面画像を生成します。
print('Apple touch icon', len(result), hashlib.sha256(result).hexdigest()) # リリース全体の固定ハッシュと照合します。
