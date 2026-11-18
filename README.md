# Vincent Ryan — Portfolio

Static site. No build step: plain HTML, CSS and JavaScript modules.

```
index.html                 Home: hero, Build, Research, About, Contact
projects/*.html            Case studies (each with an interactive demo)
css/style.css              Design system + all page styles
css/demos.css              Styles for the interactive demos
js/main.js                 Nav, reveal-on-scroll, tilt, magnifier, lightbox
js/topo.js                 Animated topographic background (hero)
js/bundles-demo.js         Bundles of Skills in-page demo
js/pitch-demo.js           Pitch Imperfect live mic demo
js/claim-race.js           Pass the Mic claim-race simulation
js/vendor/                 Unmodified modules from the bundlesofskills repo
assets/                    Images, logo, resume
```

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Use a server rather than double-clicking the HTML file, because the ES modules need one.

## Deploy (GitHub Pages)

1. Create a public repo named `Vinceafoos.github.io`.
2. Push the contents of this folder to `main`.
3. In the repo, go to Settings → Pages → Source: "Deploy from a branch", choose `main` and `/ (root)`.
4. The site goes live at https://vinceafoos.github.io within a minute or two.

For a custom domain (e.g. vincentryan.dev), add it under Settings → Pages and point the domain's DNS at GitHub Pages.

## Editing checklist

Search for `TODO(Vincent)` to find the spots that need your input (headshot, team roles, MHCI case studies, new game clips).
