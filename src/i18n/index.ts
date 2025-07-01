export interface LocaleData {
  [key: string]: string | LocaleData;
}

export interface SupportedLocales {
  en: LocaleData;
  tr: LocaleData;
}

export class I18nManager {
  private currentLocale: 'en' | 'tr' = 'en';
  private locales: SupportedLocales;

  constructor() {
    this.locales = {
      en: {
        common: {
          ok: 'OK',
          error: 'Error',
          warning: 'Warning',
          info: 'Info',
          success: 'Success',
          loading: 'Loading',
          cancel: 'Cancel',
          save: 'Save',
          delete: 'Delete',
          edit: 'Edit',
          add: 'Add',
          remove: 'Remove',
          search: 'Search',
          filter: 'Filter',
          export: 'Export',
          import: 'Import',
          refresh: 'Refresh',
          settings: 'Settings',
          help: 'Help',
          version: 'Version',
          total: 'Total',
          count: 'Count',
          name: 'Name',
          status: 'Status',
          date: 'Date',
          time: 'Time',
          size: 'Size',
          type: 'Type'
        },
        cli: {
          init: {
            title: '🚀 Initializing LogSoul...',
            configCreated: '✅ Created logsoul.yaml configuration file',
            success: '✅ LogSoul initialized successfully!',
            nextSteps: 'Next steps:',
            discover: 'logsoul discover  # Find all domains and logs',
            server: 'logsoul server    # Start web interface'
          },
          discover: {
            title: '🔍 Discovering log files and domains...',
            searching: '🔍 Discovering log files...',
            found: '✅ Found {0} log files for {1} domains',
            complete: '✅ Discovery complete!',
            logFiles: '📁 Found {0} log files',
            domains: '🌐 Found {0} domains:',
            errors: '⚠️  {0} errors occurred:'
          },
          list: {
            title: '📋 Monitored Domains:',
            empty: 'No domains found. Run "logsoul discover" first.',
            lastSeen: 'Last seen: {0}',
            health: 'Health: {0}/100',
            requests: 'Requests/min: {0}',
            errorRate: 'Error rate: {0}%'
          },
          watch: {
            title: '👀 Watching logs for {0}...',
            stop: 'Press Ctrl+C to stop',
            noLogs: 'No log files found for {0}'
          },
          stats: {
            title: '📊 Statistics for {0} (last {1}):',
            noData: 'No statistics available for {0} in the last {1}',
            healthScore: 'Health Score: {0}/100',
            requestsPerMin: 'Requests/minute: {0}',
            errorRate: 'Error rate: {0}%',
            avgResponseTime: 'Avg response time: {0}ms',
            trafficVolume: 'Traffic volume: {0}',
            uniqueIPs: 'Unique IPs: {0}'
          },
          analyze: {
            title: '🔍 Analyzing {0} (last {1})...',
            complete: '✅ Analysis complete ({0} entries):',
            topPages: '🔝 Top 10 Pages:',
            topIPs: '🌍 Top 10 IPs:',
            topErrors: '❌ Top 10 Error Pages:',
            securityThreats: '🚨 Security Threats: {0}',
            performanceIssues: '⚡ Performance Issues: {0}',
            noLogs: 'No logs found for {0} in the specified time range'
          },
          server: {
            starting: '🚀 Starting LogSoul web server...',
            available: '🌐 Server will be available at http://localhost:{0}',
            running: '✅ LogSoul server running on http://{0}:{1}',
            dashboard: '📊 Dashboard: http://{0}:{1}'
          },
          errors: {
            domainNotFound: '❌ Domain not found: {0}',
            discoverFirst: 'Run "logsoul discover" or "logsoul add <domain>" first',
            addFailed: '❌ Failed to add domain: {0}',
            generalError: '❌ An error occurred: {0}'
          },
          success: {
            domainAdded: '✅ Added domain: {0}',
            testDataGenerated: '✅ Test data generated!'
          }
        },
        web: {
          title: 'LogSoul - Feel the pulse of your domains',
          nav: {
            dashboard: 'Dashboard',
            domains: 'Domains',
            realtime: 'Real-time',
            alerts: 'Alerts',
            settings: 'Settings'
          },
          dashboard: {
            title: '📊 Dashboard',
            refresh: '🔄 Refresh',
            domains: 'Domains',
            requestsPerHour: 'Requests/hr',
            avgHealth: 'Avg Health',
            activeAlerts: 'Active Alerts',
            domainOverview: 'Domain Overview'
          },
          domains: {
            title: '🌐 Domains',
            discover: '🔍 Discover',
            addDomain: '➕ Add Domain',
            health: 'Health',
            requestsPerMin: 'Requests/min',
            errorRate: 'Error Rate',
            lastSeen: 'Last Seen',
            actions: 'Actions',
            details: '📊 Details'
          },
          realtime: {
            title: '⚡ Real-time Logs',
            selectDomain: 'Select Domain',
            start: '▶️ Start',
            stop: '⏸️ Stop',
            clear: '🗑️ Clear',
            connected: 'Connected',
            disconnected: 'Disconnected'
          },
          alerts: {
            title: '🚨 Alerts',
            refresh: '🔄 Refresh',
            noAlerts: 'No alerts found.'
          },
          settings: {
            title: '⚙️ Settings',
            monitorSettings: 'Monitor Settings',
            scanInterval: 'Scan Interval (seconds):',
            batchSize: 'Batch Size:',
            alertSettings: 'Alert Settings',
            enableEmail: 'Enable Email Alerts',
            enableWebhook: 'Enable Webhook Alerts'
          },
          modal: {
            addDomain: {
              title: 'Add Domain',
              domainName: 'Domain Name:',
              placeholder: 'example.com',
              cancel: 'Cancel',
              add: 'Add Domain'
            }
          }
        },
        monitoring: {
          fileAdded: '👀 Now monitoring: {0}',
          fileRemoved: '🚫 Stopped monitoring: {0}',
          error: '❌ File monitor error for {0}: {1}',
          fileRotated: '📄 File rotated: {0}',
          largeFile: '⚠️  Skipping large file: {0} ({1})'
        },
        alerts: {
          triggered: '🚨 Alert triggered: {0}',
          types: {
            highErrorRate: 'High Error Rate',
            slowResponse: 'Slow Response Time',
            trafficSpike: 'Traffic Spike',
            criticalErrors: 'Critical Error Rate',
            securityAttacks: 'Security Attacks Detected'
          },
          severities: {
            low: 'Low',
            medium: 'Medium',
            high: 'High',
            critical: 'Critical'
          }
        },
        security: {
          threats: {
            sqlInjection: 'SQL Injection',
            xss: 'XSS Attack',
            pathTraversal: 'Path Traversal',
            bruteForce: 'Brute Force',
            suspiciousUA: 'Suspicious User Agent'
          },
          descriptions: {
            sqlInjection: 'Detected {0} potential SQL injection attempts',
            xss: 'Detected {0} potential XSS attempts',
            pathTraversal: 'Detected {0} potential path traversal attempts',
            bruteForce: '{0} authentication failures from {1}',
            suspiciousUA: 'Detected {0} requests with suspicious user agents'
          },
          password: {
            tooShort: 'Password should be at least 16 characters long',
            needsLowercase: 'Password should contain lowercase letters',
            needsUppercase: 'Password should contain uppercase letters',
            needsNumbers: 'Password should contain numbers',
            needsSpecial: 'Password should contain special characters',
            avoidRepeating: 'Avoid repeating characters',
            tooCommon: 'Password is too common'
          },
          events: {
            intrusion: 'Intrusion attempt detected',
            blocked: 'Request blocked for security reasons',
            rateLimit: 'Rate limit exceeded',
            invalidInput: 'Invalid input detected',
            fileBlocked: 'File upload blocked'
          }
        }
      },
      tr: {
        common: {
          ok: 'Tamam',
          error: 'Hata',
          warning: 'Uyarı',
          info: 'Bilgi',
          success: 'Başarılı',
          loading: 'Yükleniyor',
          cancel: 'İptal',
          save: 'Kaydet',
          delete: 'Sil',
          edit: 'Düzenle',
          add: 'Ekle',
          remove: 'Kaldır',
          search: 'Ara',
          filter: 'Filtrele',
          export: 'Dışa Aktar',
          import: 'İçe Aktar',
          refresh: 'Yenile',
          settings: 'Ayarlar',
          help: 'Yardım',
          version: 'Sürüm',
          total: 'Toplam',
          count: 'Sayı',
          name: 'İsim',
          status: 'Durum',
          date: 'Tarih',
          time: 'Zaman',
          size: 'Boyut',
          type: 'Tip'
        },
        cli: {
          init: {
            title: '🚀 LogSoul başlatılıyor...',
            configCreated: '✅ logsoul.yaml konfigürasyon dosyası oluşturuldu',
            success: '✅ LogSoul başarıyla başlatıldı!',
            nextSteps: 'Sonraki adımlar:',
            discover: 'logsoul discover  # Tüm alan adlarını ve logları bul',
            server: 'logsoul server    # Web arayüzünü başlat'
          },
          discover: {
            title: '🔍 Log dosyaları ve alan adları keşfediliyor...',
            searching: '🔍 Log dosyaları keşfediliyor...',
            found: '✅ {1} alan adı için {0} log dosyası bulundu',
            complete: '✅ Keşif tamamlandı!',
            logFiles: '📁 {0} log dosyası bulundu',
            domains: '🌐 {0} alan adı bulundu:',
            errors: '⚠️  {0} hata oluştu:'
          },
          list: {
            title: '📋 İzlenen Alan Adları:',
            empty: 'Alan adı bulunamadı. Önce "logsoul discover" komutunu çalıştırın.',
            lastSeen: 'Son görülme: {0}',
            health: 'Sağlık: {0}/100',
            requests: 'İstek/dk: {0}',
            errorRate: 'Hata oranı: {0}%'
          },
          watch: {
            title: '👀 {0} için loglar izleniyor...',
            stop: 'Durdurmak için Ctrl+C tuşlarına basın',
            noLogs: '{0} için log dosyası bulunamadı'
          },
          stats: {
            title: '📊 {0} İstatistikleri (son {1}):',
            noData: '{0} için son {1} içinde istatistik bulunamadı',
            healthScore: 'Sağlık Skoru: {0}/100',
            requestsPerMin: 'İstek/dakika: {0}',
            errorRate: 'Hata oranı: {0}%',
            avgResponseTime: 'Ort. yanıt süresi: {0}ms',
            trafficVolume: 'Trafik hacmi: {0}',
            uniqueIPs: 'Eşsiz IP\'ler: {0}'
          },
          analyze: {
            title: '🔍 {0} analiz ediliyor (son {1})...',
            complete: '✅ Analiz tamamlandı ({0} kayıt):',
            topPages: '🔝 En Çok Ziyaret Edilen 10 Sayfa:',
            topIPs: '🌍 En Çok İstek Gönderen 10 IP:',
            topErrors: '❌ En Çok Hata Veren 10 Sayfa:',
            securityThreats: '🚨 Güvenlik Tehditleri: {0}',
            performanceIssues: '⚡ Performans Sorunları: {0}',
            noLogs: 'Belirtilen zaman aralığında {0} için log bulunamadı'
          },
          server: {
            starting: '🚀 LogSoul web sunucusu başlatılıyor...',
            available: '🌐 Sunucu http://localhost:{0} adresinde kullanılabilir olacak',
            running: '✅ LogSoul sunucusu http://{0}:{1} adresinde çalışıyor',
            dashboard: '📊 Panel: http://{0}:{1}'
          },
          errors: {
            domainNotFound: '❌ Alan adı bulunamadı: {0}',
            discoverFirst: 'Önce "logsoul discover" veya "logsoul add <domain>" komutunu çalıştırın',
            addFailed: '❌ Alan adı eklenemedi: {0}',
            generalError: '❌ Bir hata oluştu: {0}'
          },
          success: {
            domainAdded: '✅ Alan adı eklendi: {0}',
            testDataGenerated: '✅ Test verisi oluşturuldu!'
          }
        },
        web: {
          title: 'LogSoul - Alan adlarınızın nabzını hissedin',
          nav: {
            dashboard: 'Panel',
            domains: 'Alan Adları',
            realtime: 'Canlı',
            alerts: 'Uyarılar',
            settings: 'Ayarlar'
          },
          dashboard: {
            title: '📊 Panel',
            refresh: '🔄 Yenile',
            domains: 'Alan Adları',
            requestsPerHour: 'İstek/saat',
            avgHealth: 'Ort. Sağlık',
            activeAlerts: 'Aktif Uyarılar',
            domainOverview: 'Alan Adı Genel Bakış'
          },
          domains: {
            title: '🌐 Alan Adları',
            discover: '🔍 Keşfet',
            addDomain: '➕ Alan Adı Ekle',
            health: 'Sağlık',
            requestsPerMin: 'İstek/dk',
            errorRate: 'Hata Oranı',
            lastSeen: 'Son Görülme',
            actions: 'İşlemler',
            details: '📊 Detaylar'
          },
          realtime: {
            title: '⚡ Canlı Loglar',
            selectDomain: 'Alan Adı Seç',
            start: '▶️ Başlat',
            stop: '⏸️ Durdur',
            clear: '🗑️ Temizle',
            connected: 'Bağlandı',
            disconnected: 'Bağlantı Kesildi'
          },
          alerts: {
            title: '🚨 Uyarılar',
            refresh: '🔄 Yenile',
            noAlerts: 'Uyarı bulunamadı.'
          },
          settings: {
            title: '⚙️ Ayarlar',
            monitorSettings: 'İzleme Ayarları',
            scanInterval: 'Tarama Aralığı (saniye):',
            batchSize: 'Toplu İşlem Boyutu:',
            alertSettings: 'Uyarı Ayarları',
            enableEmail: 'E-posta Uyarılarını Etkinleştir',
            enableWebhook: 'Webhook Uyarılarını Etkinleştir'
          },
          modal: {
            addDomain: {
              title: 'Alan Adı Ekle',
              domainName: 'Alan Adı:',
              placeholder: 'ornek.com',
              cancel: 'İptal',
              add: 'Alan Adı Ekle'
            }
          }
        },
        monitoring: {
          fileAdded: '👀 Şimdi izleniyor: {0}',
          fileRemoved: '🚫 İzleme durduruldu: {0}',
          error: '❌ {0} için dosya izleme hatası: {1}',
          fileRotated: '📄 Dosya döndürüldü: {0}',
          largeFile: '⚠️  Büyük dosya atlanıyor: {0} ({1})'
        },
        alerts: {
          triggered: '🚨 Uyarı tetiklendi: {0}',
          types: {
            highErrorRate: 'Yüksek Hata Oranı',
            slowResponse: 'Yavaş Yanıt Süresi',
            trafficSpike: 'Trafik Artışı',
            criticalErrors: 'Kritik Hata Oranı',
            securityAttacks: 'Güvenlik Saldırıları Tespit Edildi'
          },
          severities: {
            low: 'Düşük',
            medium: 'Orta',
            high: 'Yüksek',
            critical: 'Kritik'
          }
        },
        security: {
          threats: {
            sqlInjection: 'SQL Enjeksiyonu',
            xss: 'XSS Saldırısı',
            pathTraversal: 'Dizin Geçişi',
            bruteForce: 'Kaba Kuvvet',
            suspiciousUA: 'Şüpheli Kullanıcı Ajanı'
          },
          descriptions: {
            sqlInjection: '{0} potansiyel SQL enjeksiyon denemesi tespit edildi',
            xss: '{0} potansiyel XSS denemesi tespit edildi',
            pathTraversal: '{0} potansiyel dizin geçiş denemesi tespit edildi',
            bruteForce: '{1} adresinden {0} kimlik doğrulama hatası',
            suspiciousUA: 'Şüpheli kullanıcı ajanları ile {0} istek tespit edildi'
          },
          password: {
            tooShort: 'Şifre en az 16 karakter uzunluğunda olmalıdır',
            needsLowercase: 'Şifre küçük harf içermelidir',
            needsUppercase: 'Şifre büyük harf içermelidir',
            needsNumbers: 'Şifre rakam içermelidir',
            needsSpecial: 'Şifre özel karakter içermelidir',
            avoidRepeating: 'Tekrarlayan karakterlerden kaçının',
            tooCommon: 'Şifre çok yaygın'
          },
          events: {
            intrusion: 'Saldırı girişimi tespit edildi',
            blocked: 'İstek güvenlik nedeniyle engellendi',
            rateLimit: 'Hız limiti aşıldı',
            invalidInput: 'Geçersiz giriş tespit edildi',
            fileBlocked: 'Dosya yükleme engellendi'
          }
        }
      }
    };
  }

  setLocale(locale: 'en' | 'tr'): void {
    this.currentLocale = locale;
  }

  getLocale(): 'en' | 'tr' {
    return this.currentLocale;
  }

  t(key: string, ...args: any[]): string {
    const keys = key.split('.');
    let value: any = this.locales[this.currentLocale];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English if key not found
        value = this.locales.en;
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            return key; // Return key if not found in any language
          }
        }
        break;
      }
    }

    if (typeof value === 'string') {
      // Replace placeholders {0}, {1}, etc.
      return value.replace(/\{(\d+)\}/g, (match, index) => {
        const argIndex = parseInt(index);
        return args[argIndex] !== undefined ? String(args[argIndex]) : match;
      });
    }

    return key;
  }

  // Shorthand methods for common usage
  success(message: string, ...args: any[]): string {
    return `✅ ${this.t(message, ...args)}`;
  }

  error(message: string, ...args: any[]): string {
    return `❌ ${this.t(message, ...args)}`;
  }

  warning(message: string, ...args: any[]): string {
    return `⚠️  ${this.t(message, ...args)}`;
  }

  info(message: string, ...args: any[]): string {
    return `ℹ️  ${this.t(message, ...args)}`;
  }

  loading(message: string, ...args: any[]): string {
    return `🔄 ${this.t(message, ...args)}`;
  }
}

// Singleton instance
export const i18n = new I18nManager();

// Utility function for quick translation
export function t(key: string, ...args: any[]): string {
  return i18n.t(key, ...args);
}