# Cube Coach — Rubik's Connected X

Page web qui se connecte en Bluetooth au **Rubik's Connected X** (et aux GoCube), affiche le cube en 3D tel qu'il est dans tes mains et te guide pas à pas jusqu'à la solution avec la méthode débutant (couche par couche).

## Fonctionnalités

- **Connexion Bluetooth** : chaque mouvement du vrai cube est animé en direct sur le cube 3D.
- **État réel du cube** : à la connexion, l'état mémorisé par le cube est lu automatiquement. Tu peux aussi recopier les couleurs à la main, ou appliquer un mélange en notation officielle.
- **Guide en 7 étapes** : croix blanche, coins blancs, deuxième couronne, croix jaune, arêtes jaunes, placement puis orientation des coins jaunes.
- **Guidage en direct** : la face à tourner s'allume et des flèches montrent le sens. Si tu fais un mauvais mouvement, le guide te demande simplement de l'annuler.
- **Sans cube connecté** : boutons de mouvements, clavier (`R`, `Maj+R` pour R') et bouton « Jouer le mouvement ».

## Compatibilité

Le Bluetooth web fonctionne avec Chrome et Edge sur ordinateur et Android. Sur iPhone et iPad, utilise l'application **Bluefy**.

## Intégration

```html
<iframe src="https://dwilor.github.io/rubiks-coach/?embed=1"
        width="100%" height="900" style="border:0;border-radius:12px"
        allow="bluetooth" title="Cube Coach"></iframe>
```

L'attribut `allow="bluetooth"` est indispensable pour connecter le cube depuis la page intégrée.

## Technique

Site statique, sans étape de compilation : `index.html`, `style.css` et des modules JavaScript dans `js/`.
three.js (licence MIT) est inclus dans `vendor/`. Le protocole Bluetooth du cube est repris de [csTimer](https://github.com/cs0x7f/cstimer).
