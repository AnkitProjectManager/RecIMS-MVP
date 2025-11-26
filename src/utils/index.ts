export function createPageUrl(pageName: string) {
    if (!pageName) {
        return '/';
    }

    const [rawPath, rawQuery] = pageName.split('?');
    const normalizedPath = '/' + rawPath.replace(/\s+/g, '-');

    if (!rawQuery) {
        return normalizedPath;
    }

    return `${normalizedPath}?${rawQuery}`;
}