import zlib
import struct
import math

def make_png(width, height, get_pixel):
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # Filter type 0 (None)
        for x in range(width):
            r, g, b, a = get_pixel(x, y, width, height)
            raw_data.extend([r, g, b, a])
            
    compressed = zlib.compress(bytes(raw_data), 9)
    
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    
    # IHDR
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png.extend(struct.pack('>I', len(ihdr)))
    png.extend(b'IHDR')
    png.extend(ihdr)
    png.extend(struct.pack('>I', zlib.crc32(b'IHDR' + ihdr)))
    
    # IDAT
    png.extend(struct.pack('>I', len(compressed)))
    png.extend(b'IDAT')
    png.extend(compressed)
    png.extend(struct.pack('>I', zlib.crc32(b'IDAT' + compressed)))
    
    # IEND
    png.extend(struct.pack('>I', 0))
    png.extend(b'IEND')
    png.extend(struct.pack('>I', zlib.crc32(b'IEND')))
    
    return bytes(png)

def render_icon(x, y, w, h, is_maskable=False):
    # Normalized coords [0, 1]
    nx = x / w
    ny = y / h

    # Moss Green Background (#47593f = 71, 89, 63, dark = #2d3926 = 45, 57, 38)
    grad = (nx + ny) * 0.5
    bg_r = int(78 * (1 - grad) + 45 * grad)
    bg_g = int(99 * (1 - grad) + 57 * grad)
    bg_b = int(69 * (1 - grad) + 38 * grad)
    
    if not is_maskable:
        # Rounded corners for non-maskable (radius 22%)
        corner_r = 0.22
        dx = max(0, abs(nx - 0.5) - (0.5 - corner_r))
        dy = max(0, abs(ny - 0.5) - (0.5 - corner_r))
        dist = math.sqrt(dx*dx + dy*dy)
        if dist > corner_r:
            return 0, 0, 0, 0  # transparent outer
        elif dist > corner_r - 0.01:
            alpha = int(255 * (1 - (dist - (corner_r - 0.01)) / 0.01))
            return bg_r, bg_g, bg_b, max(0, min(255, alpha))

    # Safe zone scale for notebook
    scale = 0.72 if is_maskable else 0.78
    center_x, center_y = 0.5, 0.5
    
    bx = (nx - center_x) / scale + 0.5
    by = (ny - center_y) / scale + 0.5
    
    # Notebook cover (#faf7ef = 250, 247, 239)
    # Bounds: bx in [0.20, 0.82], by in [0.15, 0.85]
    if 0.20 <= bx <= 0.82 and 0.15 <= by <= 0.85:
        # Notebook spine (#37452f = 55, 69, 47)
        if bx <= 0.30:
            return 55, 69, 47, 255
        elif abs(bx - 0.30) < 0.008:
            return 216, 208, 187, 255
            
        # Bookmark ribbon (#b8922f = 184, 146, 47)
        # Ribbon hangs from top: bx in [0.45, 0.55], by from 0.15 to 0.42
        if 0.45 <= bx <= 0.55 and 0.15 <= by <= 0.42:
            # Triangular notch at bottom of ribbon
            tri_y = 0.42 - abs(bx - 0.50) * 0.7
            if by <= tri_y:
                return 212, 170, 59, 255

        # Note lines
        line_y_list = [0.32, 0.40, 0.48, 0.56, 0.64]
        for idx, ly in enumerate(line_y_list):
            if abs(by - ly) < 0.012:
                if idx == 0:
                    if 0.35 <= bx <= 0.75:
                        return 184, 146, 47, 255
                elif 0.35 <= bx <= (0.75 - (idx * 0.06)):
                    return 180, 175, 160, 255
                    
        # Smart Pen Emblem Badge (bottom right)
        emblem_cx, emblem_cy = 0.72, 0.72
        edist = math.sqrt((bx - emblem_cx)**2 + (by - emblem_cy)**2)
        if edist <= 0.11:
            if edist > 0.10:
                return 31, 39, 26, 255
            # Pen tip inside
            if 0.67 <= bx <= 0.77 and 0.67 <= by <= 0.77:
                return 212, 170, 59, 255
            return 71, 89, 63, 255

        return 250, 247, 239, 255

    return bg_r, bg_g, bg_b, 255

import os
os.makedirs('public', exist_ok=True)

# Generate pwa-192x192.png
print("Generating pwa-192x192.png...")
with open('public/pwa-192x192.png', 'wb') as f:
    f.write(make_png(192, 192, lambda x,y,w,h: render_icon(x,y,w,h, False)))

# Generate pwa-512x512.png
print("Generating pwa-512x512.png...")
with open('public/pwa-512x512.png', 'wb') as f:
    f.write(make_png(512, 512, lambda x,y,w,h: render_icon(x,y,w,h, False)))

# Generate pwa-maskable-512x512.png
print("Generating pwa-maskable-512x512.png...")
with open('public/pwa-maskable-512x512.png', 'wb') as f:
    f.write(make_png(512, 512, lambda x,y,w,h: render_icon(x,y,w,h, True)))

# Generate apple-touch-icon.png (180x180)
print("Generating apple-touch-icon.png...")
with open('public/apple-touch-icon.png', 'wb') as f:
    f.write(make_png(180, 180, lambda x,y,w,h: render_icon(x,y,w,h, False)))

print("PWA Icons generated successfully!")
