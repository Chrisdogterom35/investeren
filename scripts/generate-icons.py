#!/usr/bin/env python3
"""Generate PNG app icons from icon.svg."""
import cairosvg

SIZES = {
    'apple-touch-icon.png': 180,
    'icon-192.png': 192,
    'icon-512.png': 512,
}

for filename, size in SIZES.items():
    cairosvg.svg2png(
        url='icon.svg',
        write_to=filename,
        output_width=size,
        output_height=size,
    )
    print(f'Wrote {filename} ({size}x{size})')
