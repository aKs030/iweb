#!/usr/bin/env python3
"""
Convert Earth Textures to WebP format for Performance Optimization

Reduziert Bildgröße um ~70% bei minimaler Qualitätseinbuße.
Verwendet Pillow (PIL) für Cross-Platform Kompatibilität.

Usage:
    python3 scripts/convert-images-to-webp.py
"""

from pathlib import Path
from PIL import Image
import sys

def convert_to_webp(source_dir: Path, quality: int = 85):
    """
    Konvertiere alle JPG-Dateien zu WebP
    
    Args:
        source_dir: Verzeichnis mit JPG-Dateien
        quality: WebP Qualität (0-100, Standard: 85)
    """
    jpg_files = list(source_dir.glob("*.jpg"))
    
    if not jpg_files:
        print(f"❌ Keine JPG-Dateien in {source_dir} gefunden")
        return
    
    print(f"🔄 Konvertiere {len(jpg_files)} Bilder zu WebP (Qualität: {quality})")
    print(f"📁 Quellverzeichnis: {source_dir}\n")
    
    total_original_size = 0
    total_webp_size = 0
    
    for jpg_file in jpg_files:
        webp_file = jpg_file.with_suffix('.webp')
        
        try:
            # Originalgröße
            original_size = jpg_file.stat().st_size
            total_original_size += original_size
            
            # Konvertierung
            print(f"⚙️  Converting: {jpg_file.name}")
            with Image.open(jpg_file) as img:
                # WebP speichern mit optimalen Einstellungen
                img.save(
                    webp_file,
                    'WebP',
                    quality=quality,
                    method=6  # Bestes Kompressionsverhältnis (langsamer, aber bessere Qualität)
                )
            
            # WebP-Größe
            webp_size = webp_file.stat().st_size
            total_webp_size += webp_size
            
            # Einsparung berechnen
            savings = ((original_size - webp_size) / original_size) * 100
            
            print(f"   ✅ {jpg_file.name}")
            print(f"      JPG:  {original_size / 1024:.1f} KB")
            print(f"      WebP: {webp_size / 1024:.1f} KB")
            print(f"      💾 Einsparung: {savings:.1f}%\n")
            
        except Exception as e:
            print(f"   ❌ Fehler bei {jpg_file.name}: {e}\n")
    
    # Gesamtstatistik
    total_savings = ((total_original_size - total_webp_size) / total_original_size) * 100
    print("=" * 60)
    print("📊 GESAMT-STATISTIK:")
    print(f"   Original (JPG):  {total_original_size / 1024:.1f} KB")
    print(f"   WebP:            {total_webp_size / 1024:.1f} KB")
    print(f"   💾 Gesamt-Einsparung: {total_savings:.1f}% ({(total_original_size - total_webp_size) / 1024:.1f} KB)")
    print("=" * 60)

def main():
    """Hauptfunktion"""
    # Pfad zu Earth-Texturen
    textures_dir = Path(__file__).parent.parent / "content" / "img" / "earth" / "textures"
    
    if not textures_dir.exists():
        print(f"❌ Verzeichnis nicht gefunden: {textures_dir}")
        sys.exit(1)
    
    # Prüfe ob Pillow installiert ist
    try:
        import PIL
        print(f"✅ Pillow Version: {PIL.__version__}\n")
    except ImportError:
        print("❌ Pillow nicht installiert!")
        print("   Installation: pip install Pillow")
        sys.exit(1)
    
    convert_to_webp(textures_dir, quality=85)
    print("\n✨ Konvertierung abgeschlossen!")
    print("💡 Tipp: Teste die WebP-Texturen im Browser für optimale Performance")

if __name__ == "__main__":
    main()
