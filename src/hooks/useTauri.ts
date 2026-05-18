import { invoke } from '@tauri-apps/api/core';

export const useTauri = () => {
  return {
    formatJson: (input: string, indent: number) => invoke<string>('format_json', { input, indent }),
    formatTolerant: (input: string) => invoke<any>('format_tolerant', { input }),
    validateJson: (input: string) => invoke<any>('validate_json', { input }),
    minifyJson: (input: string) => invoke<string>('minify_json', { input }),
    convertJson: (input: string, target: string) => invoke<string>('convert_json', { input, target }),
    jqQuery: (input: string, filter: string) => invoke<string[]>('jq_query', { input, filter }),
    testRegex: (pattern: string, input: string, flags: string) => invoke<any>('test_regex', { pattern, input, flags }),
    renderMarkdown: (input: string) => invoke<string>('render_markdown', { input }),
    diffText: (left: string, right: string) => invoke<any[]>('diff_text', { left, right }),
    urlEncode: (input: string) => invoke<string>('url_encode', { input }),
    urlDecode: (input: string) => invoke<string>('url_decode', { input }),
    decodeJwt: (token: string, secret?: string) => invoke<any>('decode_jwt', { token, secret }),
    convertColor: (input: string) => invoke<any>('convert_color', { input }),
    generateHashes: (input: string) => invoke<any>('generate_hashes', { input }),
    convertTimestamp: (input: string) => invoke<any>('convert_timestamp', { input }),
  };
};
