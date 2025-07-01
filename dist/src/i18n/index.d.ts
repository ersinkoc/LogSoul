export interface LocaleData {
    [key: string]: string | LocaleData;
}
export interface SupportedLocales {
    en: LocaleData;
    tr: LocaleData;
}
export declare class I18nManager {
    private currentLocale;
    private locales;
    constructor();
    setLocale(locale: 'en' | 'tr'): void;
    getLocale(): 'en' | 'tr';
    t(key: string, ...args: any[]): string;
    success(message: string, ...args: any[]): string;
    error(message: string, ...args: any[]): string;
    warning(message: string, ...args: any[]): string;
    info(message: string, ...args: any[]): string;
    loading(message: string, ...args: any[]): string;
}
export declare const i18n: I18nManager;
export declare function t(key: string, ...args: any[]): string;
//# sourceMappingURL=index.d.ts.map