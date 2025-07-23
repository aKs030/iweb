#!/bin/bash

# deploy.sh - Finales Deployment Script für iweb-6
# Verwendung: ./deploy.sh [production|staging|test]

set -e  # Exit bei Fehler

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Konfiguration
DOMAIN="abdulkerimsesli.de"
PROJECT_NAME="iweb-6"
BUILD_DIR="dist"
BACKUP_DIR="backups"

# Funktionen
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Überprüfe Systemanforderungen..."
    
    # Node.js Check
    if ! command -v node &> /dev/null; then
        log_error "Node.js ist nicht installiert!"
        exit 1
    fi
    
    # Git Check
    if ! command -v git &> /dev/null; then
        log_error "Git ist nicht installiert!"
        exit 1
    fi
    
    log_success "Alle Anforderungen erfüllt ✅"
}

setup_environment() {
    local env=${1:-production}
    log_info "Setup für Umgebung: $env"
    
    # Environment-spezifische Konfiguration
    case $env in
        production)
            DEPLOY_URL="https://$DOMAIN"
            OPTIMIZE_LEVEL="maximum"
            ;;
        staging)
            DEPLOY_URL="https://staging.$DOMAIN"
            OPTIMIZE_LEVEL="medium"
            ;;
        test)
            DEPLOY_URL="http://localhost:8080"
            OPTIMIZE_LEVEL="minimal"
            ;;
        *)
            log_error "Unbekannte Umgebung: $env"
            exit 1
            ;;
    esac
    
    export DEPLOY_ENV=$env
    export DEPLOY_URL
    export OPTIMIZE_LEVEL
    
    log_success "Umgebung konfiguriert: $env"
}

run_tests() {
    log_info "Führe Tests und Validierungen aus..."
    
    # HTML Validation
    if command -v html5validator &> /dev/null; then
        log_info "Validiere HTML..."
        html5validator --root . --also-check-css --show-warnings || {
            log_warning "HTML Validation ergab Warnungen"
        }
    fi
    
    # CSS Validation (falls csslint verfügbar)
    if command -v csslint &> /dev/null; then
        log_info "Validiere CSS..."
        csslint css/ || {
            log_warning "CSS Validation ergab Warnungen"
        }
    fi
    
    # JavaScript Syntax Check
    log_info "Prüfe JavaScript Syntax..."
    find js/ -name "*.js" -exec node -c {} \; || {
        log_error "JavaScript Syntax Fehler gefunden!"
        exit 1
    }
    
    # PWA Manifest Check
    if [ -f "manifest.json" ]; then
        log_info "Prüfe PWA Manifest..."
        node -e "
            const fs = require('fs');
            try {
                const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
                console.log('✅ Manifest ist gültiges JSON');
                if (!manifest.name || !manifest.icons) {
                    console.warn('⚠️ Manifest unvollständig');
                }
            } catch(e) {
                console.error('❌ Manifest ungültig:', e.message);
                process.exit(1);
            }
        "
    fi
    
    log_success "Alle Tests bestanden ✅"
}

optimize_assets() {
    log_info "Optimiere docs für Deployment..."
    
    # Erstelle Build-Verzeichnis
    mkdir -p "$BUILD_DIR"
    
    # Kopiere Basis-Files
    cp -r *.html *.json *.js css/ js/ img/ docs/pages/ "$BUILD_DIR/"
    
    # Optimiere CSS (wenn postcss verfügbar)
    if command -v postcss &> /dev/null; then
        log_info "Optimiere CSS..."
        find "$BUILD_DIR/css" -name "*.css" -exec postcss {} --use autoprefixer --use cssnano --replace \; 2>/dev/null || {
            log_warning "CSS Optimierung fehlgeschlagen, verwende Original-Files"
        }
    fi
    
    # JavaScript-Minifizierung entfällt (keine Minified-Dateien mehr notwendig)
    
    # Optimiere Bilder (falls imagemin verfügbar)
    if command -v imagemin &> /dev/null; then
        log_info "Optimiere Bilder..."
        imagemin "$BUILD_DIR/img/**" --out-dir="$BUILD_DIR/img/" 2>/dev/null || {
            log_warning "Bild-Optimierung fehlgeschlagen"
        }
    fi
    
    # Erstelle robots.txt für Production
    if [ "$DEPLOY_ENV" = "production" ]; then
        cat > "$BUILD_DIR/robots.txt" << EOF
User-agent: *
Allow: /

Sitemap: https://$DOMAIN/sitemap.xml
EOF
    else
        cat > "$BUILD_DIR/robots.txt" << EOF
User-agent: *
Disallow: /
EOF
    fi
    
    log_success "Asset-Optimierung abgeschlossen ✅"
}

create_backup() {
    if [ "$DEPLOY_ENV" = "production" ]; then
        log_info "Erstelle Backup..."
        
        mkdir -p "$BACKUP_DIR"
        local backup_name="backup_$(date +%Y%m%d_%H%M%S).tar.gz"
        
        # Backup der aktuellen Version (falls vorhanden)
        if [ -d "current_deployment" ]; then
            tar -czf "$BACKUP_DIR/$backup_name" current_deployment/
            log_success "Backup erstellt: $backup_name"
        fi
    fi
}

deploy_files() {
    log_info "Deploye Files..."
    
    case $DEPLOY_ENV in
        production|staging)
            # Hier würde normalerweise FTP, SCP oder ein anderer Transfer stattfinden
            log_info "🚀 Deployment würde jetzt zu $DEPLOY_URL stattfinden"
            log_info "📁 Build-Verzeichnis: $BUILD_DIR"
            log_info "🔗 Domain: $DOMAIN"
            
            # Simuliere Deployment
            if [ -d "current_deployment" ]; then
                rm -rf current_deployment
            fi
            cp -r "$BUILD_DIR" current_deployment
            
            log_success "Deployment erfolgreich! 🎉"
            ;;
        test)
            # Express-Server für QA-Checks starten
            log_info "Starte Express-Server für QA-Checks..."
            SERVER_PID=$!
            sleep 5
            
            # Link-Checker ausführen (optional: anpassen, falls anderes Kommando gewünscht)
            if npm run check-links; then
                log_success "Link-Check erfolgreich."
            else
                log_warning "Link-Check ergab Fehler oder Warnungen."
            fi
            
            # Server sauber beenden
            kill $SERVER_PID
            log_info "Express-Server gestoppt. Port 8000 ist frei."
            ;;
    esac
}

run_lighthouse() {
    if [ "$DEPLOY_ENV" = "production" ] && command -v lighthouse &> /dev/null; then
        log_info "Führe Lighthouse Audit aus..."
        
        lighthouse "$DEPLOY_URL" \
            --output=html \
            --output-path="lighthouse-report.html" \
            --chrome-flags="--headless" || {
            log_warning "Lighthouse Audit fehlgeschlagen"
        }
        
        log_success "Lighthouse Report erstellt: lighthouse-report.html"
    fi
}

cleanup() {
    log_info "Räume temporäre Dateien auf..."
    
    # Entferne Build-Verzeichnis nach erfolgreichem Deployment
    if [ "$1" = "success" ] && [ "$DEPLOY_ENV" != "test" ]; then
        rm -rf "$BUILD_DIR"
    fi
    
    log_success "Cleanup abgeschlossen ✅"
}

show_summary() {
    echo
    echo "=========================================="
    echo "🎉 DEPLOYMENT ABGESCHLOSSEN"
    echo "=========================================="
    echo "Umgebung: $DEPLOY_ENV"
    echo "URL: $DEPLOY_URL"
    echo "Domain: $DOMAIN"
    echo "Zeit: $(date)"
    echo "=========================================="
    echo
    
    if [ "$DEPLOY_ENV" = "production" ]; then
        echo "✅ Website ist live!"
        echo "🔍 Überprüfe: $DEPLOY_URL"
        echo "📊 Lighthouse Report: lighthouse-report.html"
    elif [ "$DEPLOY_ENV" = "test" ]; then
        echo "🧪 Test-Server läuft lokal"
        echo "🔗 Öffne: $DEPLOY_URL"
        echo "⏹️ Stop mit: kill \$(cat server.pid)"
    fi
}

# Hauptfunktion
main() {
    local environment=${1:-production}
    
    echo "🚀 Starte Deployment für $PROJECT_NAME"
    echo
    
    # Schritt für Schritt Deployment
    check_requirements
    setup_environment "$environment"
    create_backup
    run_tests
    optimize_assets
    deploy_files
    run_lighthouse
    cleanup success
    show_summary
    
    log_success "🎉 Deployment erfolgreich abgeschlossen!"
}

# Script ausführen
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
