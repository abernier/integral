# integral

<Intro>

Parametric furniture parts in [ClassCAD](https://classcad.ch), editable in [Buerligons](https://buerligons.io).

</Intro>

[![site](https://img.shields.io/badge/site-GitHub_Pages-555)](https://abernier.github.io/integral) [![build](https://github.com/abernier/integral/actions/workflows/pages.yml/badge.svg)](https://github.com/abernier/integral/actions/workflows/pages.yml)

## Parts

<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
<a href="https://abernier.github.io/integral/zigzag-chair/introduction" className="block rounded-lg border border-outline-variant p-4 no-underline">
<img src="https://abernier.github.io/integral/zigzag-chair/zigzag-chair.png" alt="Zigzag chair" width="320" />
<strong>Zigzag chair</strong>: cherry, 370 × 480 × 742.6 mm
</a>
</div>

## Build

<Steps>

<Step>Install</Step>

```sh
pnpm install
```

<Step>Work on the site, live</Step>

```sh
nr dev        # localhost:3000; saving a part's .ts rebuilds it
```

<Step>Check and build</Step>

```sh
nr typecheck  # tsc --noEmit
nr build      # parts + site into dist/
```

</Steps>

- Part: `<folder>/<folder>.ts` + `README.md`; generated files stay out of git
- Engine key: local ClassCAD sign-in; in CI, the `CLASSCAD_TOKEN` secret
- Deploy: every push to `main`, GitHub Pages
