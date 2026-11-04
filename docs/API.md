# Contrat d'API attendu par le frontend TWIN_3

Base : `VITE_API_URL` (défaut `http://localhost:3000/api`). JSON, champs en camelCase, dates `AAAA-MM-JJ`, heures `HH:MM`.
Authentification : `Authorization: Bearer <token>`. Erreurs : statut HTTP + `{ "message": "texte clair en français" }`
(409 pour une suppression impossible car référencée, 401 = session expirée → retour à la connexion).

Types exacts : `src/lib/api/types.ts`.

| Méthode | Chemin | Corps / réponse |
|---|---|---|
| POST | /auth/login | `{identifiant, motDePasse}` → `{token, utilisateur}` |
| GET | /auth/me | → `Utilisateur {id, identifiant, role, matricule}` |
| POST | /auth/logout | → 204 |
| CRUD | /comptes, /ateliers, /lignes, /machines, /equipes, /operateurs, /produits, /types-incident, /incidents, /lots, /maintenances, /fournisseurs, /pieces | `GET /x` (liste), `GET /x/:id`, `POST /x`, `PUT /x/:id`, `DELETE /x/:id` |
| PATCH | /produits/:ref/stock, /pieces/:ref/stock | `{qteStock}` |
| GET/POST | /pieces/:ref/composition | `[{pieceComposant, quantite}]` / `{pieceComposant, quantite}` |
| PUT/DELETE | /pieces/:ref/composition/:composant | `{quantite}` |
| GET | /approvisionnements?reference= | liste `{reference, codeFournisseur, dateAchat, prixAchat}` |
| POST | /approvisionnements | idem |
| DELETE | /approvisionnements?reference=&codeFournisseur=&dateAchat= | → 204 |

Rôles : `ADMIN`, `RESPONSABLE`, `OPERATEUR`, `MAGASINIER`. Le backend doit aussi vérifier les droits et les contrôles
de la section 4.1 (stock suffisant + décrément à la création d'une maintenance, temps d'arrêt ≥ 0, etc.).
Les indicateurs du tableau de bord sont calculés côté navigateur à partir des listes.
