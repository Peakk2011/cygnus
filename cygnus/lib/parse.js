// @fileoverview parse using() calls and strip boilerplate from .html source

const USING_RE = /using\(\s*['"](.+?)['"]\s*,\s*['"](.+?)['"]\s*\)/g;

const DOCTYPE_RE = /<!DOCTYPE\s+html>\s*/i;
const HTML_OPEN_RE = /<html([^>]*)>\s*/i;
const HTML_CLOSE_RE = /\s*<\/html>/i;

// extract using() calls ที่อยู่ก่อน <html
const extractCalls = (raw) => {
    const beforeHtml = raw.split(/<html/i)[0];
    const calls = [];
    let match;

    while ((match = USING_RE.exec(beforeHtml)) !== null) {
        calls.push({ sel: match[1], src: match[2] });
    }

    return calls;
};

// strip using() calls, <!DOCTYPE html>, <html>, </html>
// ส่งคืนแค่ content ข้างใน
const strip = (raw) => {
    // เอาทุกอย่างก่อน <html ออก (using() calls อยู่ตรงนี้)
    let out = raw.replace(/^[\s\S]*?(?=<html)/i, '');

    // เอา <!DOCTYPE html> ออก ถ้ามี
    out = out.replace(DOCTYPE_RE, '');

    // เก็บ lang attribute แล้วเอา <html ...> ออก
    const langMatch = out.match(HTML_OPEN_RE);
    const lang = langMatch?.[1]?.trim() || 'lang="en"';

    out = out.replace(HTML_OPEN_RE, '');
    out = out.replace(HTML_CLOSE_RE, '');

    return { content: out.trim(), lang };
};

export { extractCalls, strip };