<div align="center">
  <img src="web/static/nostter-logo.svg" height="50">
  <p>
  Nostr client for web.

  [https://nostter.vercel.app/](https://nostter.vercel.app/home)
  </p>
</div>

## How to login

- [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md#implementation) browser extensions (recommended)
- `nsec`
- `npub` for readonly

## Share on nostter

Link to

```
https://nostter.vercel.app/post?content={url-encoded-text-here}
```

<details>
<summary>Bookmarklet</summary>

```js
javascript:window.open(`https://nostter.vercel.app/post?content=${document.title}%20${location.href}`);
```

</details>

## Dependencies

- [Nostr](https://github.com/nostr-protocol/nostr), [nostr-tools](https://github.com/nbd-wtf/nostr-tools)
- Svelte, SvelteKit, Vite
- TypeScript, JavaScript, Node.js
- Vitest, Playwright
- [Tabler Icons for Svelte](https://tabler.io/docs/icons/svelte)

## License

© 2023 SnowCait

This is NOT a OSS.  
You can refer to a piece of code, but you cannot provide this software as a service.

## Contribution

Welcome issues, pull requests and discussions after understanding above.

## Special Thanks

Illustration by [@stok33](https://nostter.vercel.app/npub1e09suzmq9mp6nt0ud9ttl03790qjx70wzwlc2pwwghcusvwju54qs0c800)

<img src="web/static/nostter-chan.jpg" width="25%">
