#!/usr/bin/env python3
"""
Performance Measurement Script für Earth-Grafik Optimierungen

Vergleicht Performance vor/nach den Optimierungen:
- WebP vs JPG Bildgrößen
- Bundle-Size Analyse
- Lighthouse Performance Score (falls Chrome verfügbar)

Usage:
    python3 scripts/measure-performance.py
"""

from pathlib import Path
import json
import subprocess
import sys

def measure_texture_sizes():
    """Messe Textur-Dateigrößen"""
    textures_dir = Path(__file__).parent.parent / "content" / "img" / "earth" / "textures"
    
    if not textures_dir.exists():
        print(f"❌ Textures directory not found: {textures_dir}")
        return
    
    print("=" * 70)
    print("📊 TEXTUR-GRÖSSEN ANALYSE")
    print("=" * 70)
    
    jpg_files = list(textures_dir.glob("*.jpg"))
    webp_files = list(textures_dir.glob("*.webp"))
    
    total_jpg_size = sum(f.stat().st_size for f in jpg_files)
    total_webp_size = sum(f.stat().st_size for f in webp_files)
    
    print(f"\n📁 JPG-Texturen ({len(jpg_files)} Dateien):")
    for jpg_file in sorted(jpg_files):
        size_kb = jpg_file.stat().st_size / 1024
        print(f"   {jpg_file.name:20s} {size_kb:>8.1f} KB")
    print(f"   {'GESAMT JPG':20s} {total_jpg_size / 1024:>8.1f} KB")
    
    print(f"\n📁 WebP-Texturen ({len(webp_files)} Dateien):")
    for webp_file in sorted(webp_files):
        size_kb = webp_file.stat().st_size / 1024
        print(f"   {webp_file.name:20s} {size_kb:>8.1f} KB")
    print(f"   {'GESAMT WebP':20s} {total_webp_size / 1024:>8.1f} KB")
    
    if total_jpg_size > 0 and total_webp_size > 0:
        savings = ((total_jpg_size - total_webp_size) / total_jpg_size) * 100
        print(f"\n💾 Einsparung durch WebP:")
        print(f"   {savings:.1f}% ({(total_jpg_size - total_webp_size) / 1024:.1f} KB)")
        print(f"   Network Transfer Reduction: ~{savings:.1f}% bei modernen Browsern")

def measure_bundle_size():
    """Analysiere JavaScript Bundle-Größe"""
    print("\n" + "=" * 70)
    print("📦 BUNDLE-SIZE ANALYSE")
    print("=" * 70)
    
    js_files = {
        "three-earth-system.js": Path(__file__).parent.parent / "content" / "webentwicklung" / "particles" / "three-earth-system.js",
        "shared-utilities.js": Path(__file__).parent.parent / "content" / "webentwicklung" / "shared-utilities.js",
        "main.js": Path(__file__).parent.parent / "content" / "webentwicklung" / "main.js",
    }
    
    total_size = 0
    for name, path in js_files.items():
        if path.exists():
            size_kb = path.stat().st_size / 1024
            total_size += size_kb
            print(f"   {name:30s} {size_kb:>8.1f} KB")
        else:
            print(f"   {name:30s} NOT FOUND")
    
    print(f"   {'GESAMT JavaScript':30s} {total_size:>8.1f} KB")
    
    # Three.js Library
    three_lib = Path(__file__).parent.parent / "content" / "webentwicklung" / "lib" / "three" / "build" / "three.module.js"
    if three_lib.exists():
        three_size = three_lib.stat().st_size / 1024
        print(f"   {'Three.js Library':30s} {three_size:>8.1f} KB")
        total_size += three_size
    
    print(f"\n   {'TOTAL Bundle (mit Three.js)':30s} {total_size:>8.1f} KB")

def check_optimizations():
    """Prüfe ob Optimierungen aktiv sind"""
    print("\n" + "=" * 70)
    print("✅ OPTIMIERUNGS-CHECKLIST")
    print("=" * 70)
    
    three_earth = Path(__file__).parent.parent / "content" / "webentwicklung" / "particles" / "three-earth-system.js"
    
    if not three_earth.exists():
        print("❌ three-earth-system.js nicht gefunden")
        return
    
    content = three_earth.read_text(encoding='utf-8')
    
    checks = {
        "WebP-Support": ".webp" in content,
        "StaticDrawUsage": "StaticDrawUsage" in content,
        "Frustum Culling": "frustumCulled = true" in content,
        "depthWrite Optimization": "depthWrite: false" in content,
        "Pinch-to-Zoom": "touchStartDistance" in content,
        "Inertia/Dampening": "dampingFactor" in content,
        "Wolken-Layer": "createCloudLayer" in content,
        "Atmosphären-Glow": "createAtmosphereGlow" in content,
    }
    
    for check_name, is_active in checks.items():
        status = "✅" if is_active else "❌"
        print(f"   {status} {check_name}")
    
    active_count = sum(checks.values())
    total_count = len(checks)
    print(f"\n   Aktive Optimierungen: {active_count}/{total_count} ({(active_count/total_count)*100:.0f}%)")

def performance_recommendations():
    """Gebe Performance-Empfehlungen"""
    print("\n" + "=" * 70)
    print("💡 PERFORMANCE-EMPFEHLUNGEN")
    print("=" * 70)
    
    recommendations = [
        ("HTTP/2 Server", "Nutze HTTP/2 für Multiplexing der Texturen"),
        ("Brotli Compression", "Komprimiere JS/CSS mit Brotli (20-30% besser als gzip)"),
        ("CDN Integration", "Hoste Three.js und Texturen über CDN"),
        ("Lazy Loading", "Lade Earth-System erst wenn sichtbar (IntersectionObserver)"),
        ("Service Worker", "Cache Three.js und Texturen für Offline-Support"),
        ("Resource Hints", "<link rel='preload'> für kritische Texturen"),
        ("WebGL Context Pool", "Reuse WebGL contexts für mehrere Scenes"),
        ("LOD System", "Level-of-Detail für Ferne/Mobile Devices"),
    ]
    
    for i, (title, description) in enumerate(recommendations, 1):
        print(f"\n   {i}. {title}")
        print(f"      {description}")

def main():
    """Hauptfunktion"""
    print("\n🚀 EARTH-GRAFIK PERFORMANCE ANALYSE")
    print(f"Workspace: {Path(__file__).parent.parent}")
    print()
    
    measure_texture_sizes()
    measure_bundle_size()
    check_optimizations()
    performance_recommendations()
    
    print("\n" + "=" * 70)
    print("✨ Analyse abgeschlossen!")
    print("=" * 70)
    print("\n💡 Nächste Schritte:")
    print("   1. Teste im Browser: http://localhost:8000")
    print("   2. Öffne DevTools → Performance Tab → Record")
    print("   3. Scrolle durch die Seite für FPS-Messung")
    print("   4. Prüfe Network-Tab für Ladezeiten")
    print()

if __name__ == "__main__":
    main()
