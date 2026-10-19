-- DOM EXTRA: pregled stvarnih kategorija iz SQL baze.
-- Ovaj fajl samo cita podatke; ne menja i ne dodaje nista u bazu.

-- 1) Sve kategorije i broj proizvoda po kategoriji.
SELECT pg.name AS kategorija, COUNT(p.id) AS broj_proizvoda
FROM product_groups AS pg
LEFT JOIN products AS p ON p.group_name = pg.name
GROUP BY pg.name
ORDER BY pg.name;

-- 2) Kategorije koje trenutno nemaju nijedan proizvod.
SELECT pg.name AS prazna_kategorija
FROM product_groups AS pg
LEFT JOIN products AS p ON p.group_name = pg.name
GROUP BY pg.name
HAVING COUNT(p.id) = 0
ORDER BY pg.name;

-- Ikonice na početnoj strani se generišu za svaki naziv iz product_groups.
-- Ne dodajemo lažne kategorije/proizvode: nove kategorije treba kreirati u
-- Django adminu ili tek kada postoje stvarni proizvodi koji pripadaju toj grupi.
