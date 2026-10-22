#!/usr/bin/env python3
"""Draws the launcher icon (app/icon.png and app/largeIcon.png) with no image libraries.

A dark rounded square with three bars that fade out downwards, echoing the home screen's app list.
"""
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SS = 4   # supersampling for smooth edges


def rounded(x, y, x0, y0, x1, y1, r):
    """Is (x, y) inside the rounded rectangle?"""
    if not (x0 <= x <= x1 and y0 <= y <= y1):
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def render(size):
    pixels = bytearray()
    n = size * SS
    bars = [(0.20, 0.30, 0.80, 1.0), (0.20, 0.48, 0.68, 0.62), (0.20, 0.66, 0.56, 0.34)]
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            r = g = b = a = 0.0
            for sy in range(SS):
                for sx in range(SS):
                    x = (px * SS + sx + 0.5) / n
                    y = (py * SS + sy + 0.5) / n
                    if not rounded(x, y, 0, 0, 1, 1, 0.22):
                        continue
                    t = (x + y) / 2
                    cr, cg, cb = 14 + 40 * t, 20 + 24 * t, 44 + 70 * t   # deep blue to violet
                    for (bx, by, bx1, op) in bars:
                        if rounded(x, y, bx, by, bx1, by + 0.10, 0.05):
                            cr, cg, cb = cr + (255 - cr) * op, cg + (255 - cg) * op, cb + (255 - cb) * op
                    r += cr; g += cg; b += cb; a += 1
            k = SS * SS
            if a:
                row += bytes([round(r / a), round(g / a), round(b / a), round(255 * a / k)])
            else:
                row += bytes([0, 0, 0, 0])
        pixels += row
    return pixels


def write_png(path, size):
    raw = bytes(render(size))
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) \
        + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


if __name__ == "__main__":
    write_png(os.path.join(ROOT, "app", "icon.png"), 80)
    write_png(os.path.join(ROOT, "app", "largeIcon.png"), 130)
    print("icons written")
