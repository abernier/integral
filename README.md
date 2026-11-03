# integral

We integrate others' work into things.

<Intro>

Real objects, designed and made with whatever tools fit: CAD, code, machines.

</Intro>

## Parts

| | Part |
|---|---|
| <a href="https://abernier.github.io/integral/things/compass-armchair"><img src="https://abernier.github.io/integral/compass-armchair/compass-armchair.png" alt="Compass armchair" width="72" /></a> | **[Compass armchair](https://abernier.github.io/integral/things/compass-armchair)**: A cane armchair on compass legs, after the 1955 Chandigarh office chair, parametric, in teak. |
| <a href="https://abernier.github.io/integral/things/zigzag-chair"><img src="https://abernier.github.io/integral/zigzag-chair/zigzag-chair.png" alt="Zigzag chair" width="72" /></a> | **[Zigzag chair](https://abernier.github.io/integral/things/zigzag-chair)**: Rietveld's 1934 Zig-Zag chair, parametric, in cherry. |

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
- CAM: `pnpm cam <folder>`, see [CAM](https://abernier.github.io/integral/integral/cam)
- Deploy: every push to `main`, GitHub Pages; every pull request, a Vercel preview (`vercel.json`, the engine key in its `CLASSCAD_TOKEN` variable)

## Pipeline

From a part's code to the machine. `nr build` runs in CI; `pnpm cam` only on a machine with Fusion desktop open.

```mermaid
flowchart TD
  ts["part.ts<br/>parameters"] -->|nr build<br/>ClassCAD| out["STEP, OFB, GLB, PNG<br/>.docs/part/"]
  out --> site["site<br/>GitHub Pages"]
  out --> bl["Buerligons<br/>edit online"]
  out -->|pnpm cam| fusion["Fusion desktop<br/>local MCP server"]
  ts -->|CAM export<br/>skips, wedge setups| fusion
  tools["tools.json, materials.json<br/>cutters, feeds, materials"] --> fusion
  fusion -->|Arrange: parts nested<br/>by material and thickness| sheets["sheets per material<br/>and thickness, as many as it takes"]
  sheets -->|CAM + ShopBot post| sbp[".sbp per sheet<br/>+ cam.json"]
  sbp -->|simulate, air-cut| shopbot["ShopBot"]
```
