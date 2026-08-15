// Work around blossom-client-sdk resolving its optional Cashu peer dependency during Wrangler bundling.
throw new Error('Cashu payment support is not enabled');
