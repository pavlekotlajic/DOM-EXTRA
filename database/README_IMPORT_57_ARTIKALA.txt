DOM EXTRA — demo SQL import (57 artikala / 19 brendova)

VAŽNO:
- Ovo je DEMO/početni katalog. Cene su indikativne, nisu garantovane zvanične aktuelne cene.
- Proizvodi su primeri za popunjavanje dizajna i testiranje API-ja. Pre javnog puštanja proveriti nazive/model šifre, cene, specifikacije, porez i dostupnost sa dobavljačima.
- Slike u media/products/demo/ su ilustrativne SVG slike za prikaz u katalogu, nisu zvanične fotografije proizvoda.
- Import dodaje DEMO- SKU-ove i demo-* ID-jeve. Ne briše postojeće artikle. Ponovni import ažurira samo iste demo zapise.
- SQL cilja Django modele iz shop/models.py: brands, product_groups, products (MySQL/MariaDB).
- Brend GROCHE je normalizovan na GROHE, uobičajeno ime brenda.
- Pre uvoza napravi backup baze. U MySQL Workbench-u otvori database/import_brendovi_57_demo_artikala.sql i izvrši ga nad bazom domextra.
