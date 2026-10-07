# DOM EXTRA Django + MySQL

Django + MySQL backend with the original DOM EXTRA frontend.

## Pokretanje

```bash
cd domextra-django-final-working
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python manage.py runserver
```

Set `.env` with `DB_USER`, `DB_PASSWORD`, `DB_NAME=domextra`.

## Rute

- `/`
- `/web-shop/`
- `/b2b/`
- `/admin/`
- `/o-nama/`
- `/kontakt/`

## Poslednje ispravke

- Korpa je browser-only i ne zavisi od admin/B2B tokena.
- Product IDs se normalizuju kao stringovi.
- Cart state se izlaže preko `window.domextraShopCart`.
- Product state se izlaže preko `window.domextraProducts`.
- Safari cache se za frontend JS bustuje verzijom `?v=20261003`.
- Upload slika proizvoda prihvata JPG/PNG/WEBP/GIF do 10 MB.
- Django upload limit je podignut na 12 MB.
- Banneri i promo kodovi rade preko MySQL/Django API-ja.


### SMTP za stvarno slanje mejla
U `.env` podesite `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` i `DEFAULT_FROM_EMAIL`. Bez SMTP-a porudžbina se i dalje čuva, ali slanje mejla neće biti izvršeno.


## Najnovije izmene
- Podešavanja modula su dostupna samo nakon administratorske prijave.
- Checkout se nakon uspešne Web Shop porudžbine vraća na Step 1 i briše checkout podatke.
