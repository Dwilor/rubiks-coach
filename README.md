# CUBE·ALGO 8-BIT + Rubik's Connected X

Tous les algos du 3×3 (débutant, F2L, OLL, PLL) avec un cube pixel animé, et maintenant la connexion Bluetooth au **Rubik's Connected X**.

- **Appli principale** : https://dwilor.github.io/rubiks-coach/
- **Ancienne version « Cube Coach »** : https://dwilor.github.io/rubiks-coach/coach/

## Onglet ◉ MON CUBE

- Connexion Bluetooth : le cube pixel suit tes mouvements en direct.
- L'état réel du cube est lu à la connexion. On peut aussi recopier les couleurs à la main ou appliquer un mélange.
- Résolution guidée en **Débutant**, **CFOP 2-look** ou **CFOP complet**. À chaque étape, l'appli trouve ton cas parmi ses algos, indique comment tenir le cube et suit chaque mouvement. En cas d'erreur, elle te demande de l'annuler.

## Entraînement dans les autres onglets

Quand le cube est connecté, l'algo sélectionné (débutant, F2L, OLL, PLL, mode guidé) avance au rythme de tes mouvements.

## Compatibilité

Le Bluetooth fonctionne avec Chrome ou Edge sur ordinateur et Android, ou avec l'appli **Bluefy** sur iPhone.

## Intégration

```html
<iframe src="https://dwilor.github.io/rubiks-coach/" width="100%" height="1000"
        style="border:0" allow="bluetooth" title="CUBE·ALGO"></iframe>
```

`allow="bluetooth"` est indispensable pour connecter le cube depuis une page intégrée.
