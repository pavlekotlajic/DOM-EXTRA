CREATE DATABASE IF NOT EXISTS domextra CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE domextra;

CREATE TABLE IF NOT EXISTS settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  firm VARCHAR(180) NOT NULL,
  address VARCHAR(220) NOT NULL,
  city VARCHAR(120) NOT NULL,
  pib VARCHAR(32) NOT NULL,
  mb VARCHAR(32) NOT NULL,
  account VARCHAR(64) NOT NULL,
  official_mail VARCHAR(180) NOT NULL,
  invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'DE',
  payment_days INT NOT NULL DEFAULT 5,
  phone VARCHAR(50) NOT NULL,
  second_phone VARCHAR(50) NULL,
  working_hours VARCHAR(180) NULL,
  order_seq INT NOT NULL DEFAULT 1001,
  invoice_seq INT NOT NULL DEFAULT 1001
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admins (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS buyers (
  id VARCHAR(64) PRIMARY KEY,
  company VARCHAR(180) NOT NULL,
  email VARCHAR(180) NOT NULL,
  address VARCHAR(220) NOT NULL,
  city VARCHAR(120) NOT NULL,
  pib VARCHAR(32) NOT NULL,
  mb VARCHAR(32) NOT NULL,
  account VARCHAR(64) NOT NULL,
  class VARCHAR(2) NOT NULL DEFAULT 'A',
  payment_days INT NOT NULL DEFAULT 30,
  special_discount DECIMAL(7,2) NOT NULL DEFAULT 0,
  username VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brands (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  category VARCHAR(120) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_groups (
  name VARCHAR(120) NOT NULL PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(220) NOT NULL,
  description TEXT,
  group_name VARCHAR(120) NOT NULL,
  sku VARCHAR(80) NOT NULL UNIQUE,
  barcode VARCHAR(50) NULL,
  unit VARCHAR(30) NOT NULL DEFAULT 'kom',
  pack_qty DECIMAL(12,3) NOT NULL DEFAULT 1,
  pack_name VARCHAR(40) NOT NULL DEFAULT 'kom',
  vp_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  mp_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  old_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  sale_until DATETIME NULL,
  brand VARCHAR(120) NULL,
  is_new TINYINT(1) NOT NULL DEFAULT 0,
  long_desc TEXT,
  gallery_json JSON NULL,
  specs_json JSON NULL,
  stock DECIMAL(14,3) NOT NULL DEFAULT 0,
  weight_kg DECIMAL(12,3) NOT NULL DEFAULT 0,
  action_discount DECIMAL(7,2) NOT NULL DEFAULT 0,
  special_discount DECIMAL(7,2) NOT NULL DEFAULT 0,
  advance_discount DECIMAL(7,2) NOT NULL DEFAULT 0,
  logistics_discount DECIMAL(7,2) NOT NULL DEFAULT 0,
  rating DECIMAL(4,2) NOT NULL DEFAULT 0,
  image TEXT,
  icon VARCHAR(30) DEFAULT '📦',
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NULL,
  INDEX idx_products_group (group_name),
  INDEX idx_products_brand (brand),
  CONSTRAINT fk_products_group FOREIGN KEY (group_name) REFERENCES product_groups(name) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coupons (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(60) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  type VARCHAR(10) NOT NULL,
  value DECIMAL(14,2) NOT NULL,
  min_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  max_uses INT NOT NULL DEFAULT 100,
  used INT NOT NULL DEFAULT 0,
  valid_until DATE NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS courier_settings (
  id TINYINT UNSIGNED PRIMARY KEY,
  free_from DECIMAL(14,2) NOT NULL DEFAULT 0,
  def_weight DECIMAL(12,3) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS courier_zones (
  kg DECIMAL(12,3) PRIMARY KEY,
  price DECIMAL(14,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sale_banner (
  id TINYINT UNSIGNED PRIMARY KEY,
  active TINYINT(1) NOT NULL DEFAULT 1,
  title VARCHAR(255) NOT NULL,
  text VARCHAR(500) NOT NULL,
  cta VARCHAR(120) NOT NULL,
  bg VARCHAR(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS locations (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  phone VARCHAR(80) NULL,
  address VARCHAR(255) NOT NULL,
  hours VARCHAR(255) NULL,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) PRIMARY KEY,
  number VARCHAR(80) NOT NULL UNIQUE,
  invoice_number VARCHAR(80) NOT NULL UNIQUE,
  channel VARCHAR(20) NOT NULL,
  buyer_id VARCHAR(64) NULL,
  buyer_name VARCHAR(180) NULL,
  created_at DATETIME(6) NOT NULL,
  status VARCHAR(40) NOT NULL,
  customer_json JSON NULL,
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
  coupon_discount DECIMAL(14,2) NOT NULL DEFAULT 0,
  gross DECIMAL(14,2) NOT NULL DEFAULT 0,
  shipping_json JSON NULL,
  base DECIMAL(14,2) NOT NULL DEFAULT 0,
  vat DECIMAL(14,2) NOT NULL DEFAULT 0,
  total DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(80) NULL,
  payment_due_date DATE NULL,
  updated_at DATETIME(6) NULL,
  INDEX idx_orders_created (created_at),
  INDEX idx_orders_channel (channel),
  INDEX idx_orders_buyer (buyer_id),
  CONSTRAINT fk_orders_buyer FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NULL,
  sku VARCHAR(80) NULL,
  name VARCHAR(220) NOT NULL,
  qty DECIMAL(14,3) NOT NULL,
  unit VARCHAR(30) NULL,
  unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  gross DECIMAL(14,2) NOT NULL DEFAULT 0,
  red DECIMAL(7,2) NOT NULL DEFAULT 0,
  pos DECIMAL(7,2) NOT NULL DEFAULT 0,
  ak DECIMAL(7,2) NOT NULL DEFAULT 0,
  av DECIMAL(7,2) NOT NULL DEFAULT 0,
  log DECIMAL(7,2) NOT NULL DEFAULT 0,
  net_unit DECIMAL(14,2) NOT NULL DEFAULT 0,
  net DECIMAL(14,2) NOT NULL DEFAULT 0,
  INDEX idx_order_items_order (order_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(64) NOT NULL,
  buyer VARCHAR(180) NOT NULL,
  rating DECIMAL(3,1) NOT NULL,
  comment TEXT NOT NULL,
  date DATE NOT NULL,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_reviews_product (product_id),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qa (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(64) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  date DATE NOT NULL,
  INDEX idx_qa_product (product_id),
  CONSTRAINT fk_qa_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contacts (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL,
  phone VARCHAR(50) NULL,
  topic VARCHAR(120) NULL,
  message TEXT NOT NULL,
  created_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO settings (id,firm,address,city,pib,mb,account,official_mail,invoice_prefix,payment_days,phone,second_phone,working_hours,order_seq,invoice_seq) VALUES (1,'DOM EXTRA DOO','Bulevar Oslobođenja 123','11000 Beograd','109876543','21345678','265-1100310008888-77','prodaja@domextra.net','DE',5,'+381 11 123 4567','+381 60 123 4567','Pon–Pet: 08:00–18:00 · Subota: 09:00–14:00',1001,1001);
INSERT IGNORE INTO admins (id,username,password_hash,role,created_at) VALUES ('adm_1','admin','scrypt$cecc784a83e6b6118476b3eb69c0b034$afe1835f746b938fbf4b9769f86a55cab84d96bd8b2276f78104f48e76073d73b9ca0c1d0e17cc7f9facd64e65e1da6ee335b2fb9863bcebc161f41173ab2f7b','admin','2026-09-28 13:47:09.775');
INSERT IGNORE INTO buyers (id,company,email,address,city,pib,mb,account,class,payment_days,special_discount,username,password_hash,active,created_at) VALUES ('buyer_1','Gradnja Komerc','nabavka@gradnjakomerc.rs','Vojvode Stepe 10','11000 Beograd','100200300','21003001','205-1234567890123-11','B',30,2,'gradnja.komerc','scrypt$4382a9c112e1c6a5660d9450ab6021e6$ec472db6bfee7a04e72187e9db1f97addef18d40fe1d2685661a2b501251b5bcde794a1bbe8c35e2128c0ec6c3e4cf7c64b6b8b2a62913e65c37b055ea3bd9be',1,'2026-09-28 13:47:09.819');
INSERT IGNORE INTO brands (id,name,category,active,created_at) VALUES
('br_stonetech','StoneTech','Keramika',1,NOW(6)),
('br_aqualux','AquaLux','Sanitarija',1,NOW(6)),
('br_baumix','BauMix','Lepkovi i mase',1,NOW(6)),
('br_thermopro','ThermoPro','Grejanje',1,NOW(6)),
('br_elektrodom','ElektroDom','Bela Tehnika',1,NOW(6)),
('br_aqualuxpro','AquaLux Pro','Armature',1,NOW(6)),
('br_stonetechxl','StoneTech XL','Veliki formati',1,NOW(6));

INSERT IGNORE INTO product_groups (name) VALUES ('Sanitarija');
INSERT IGNORE INTO product_groups (name) VALUES ('Pločice');
INSERT IGNORE INTO product_groups (name) VALUES ('Grejanje');
INSERT IGNORE INTO product_groups (name) VALUES ('Lepkovi i mase');
INSERT IGNORE INTO product_groups (name) VALUES ('Bela Tehnika');
INSERT IGNORE INTO products (id,name,description,group_name,sku,barcode,unit,pack_qty,pack_name,vp_price,mp_price,old_price,sale_until,brand,is_new,long_desc,gallery_json,specs_json,stock,weight_kg,action_discount,special_discount,advance_discount,logistics_discount,rating,image,icon,created_at) VALUES ('p_1','StoneTech Marble Sand 60×60','Porculanska pločica mat završnice, premium serija.','Pločice','ST-MAR-6060','8600000000011','m²',1.44,'kutija',2100,2890,3190,'2026-12-31 23:59','StoneTech',1,'Porculanska gres pločica 60×60 cm, pogodna za podove i zidove.','["🧱", "🏺", "🪨"]','[["Dimenzije", "60×60 cm"], ["Debljina", "9 mm"], ["Klasa", "PEI IV"], ["Garancija", "5 godina"]]',120,23,5,0,3,2,4.9,'','🧱','2026-09-28 13:47:09.819');
INSERT IGNORE INTO products (id,name,description,group_name,sku,barcode,unit,pack_qty,pack_name,vp_price,mp_price,old_price,sale_until,brand,is_new,long_desc,gallery_json,specs_json,stock,weight_kg,action_discount,special_discount,advance_discount,logistics_discount,rating,image,icon,created_at) VALUES ('p_2','AquaLux Rim WC set','Viseća WC šolja sa soft-close daskom.','Sanitarija','AL-WC-001','8600000000028','kom',1,'kom',12500,16990,18990,'2026-11-30 23:59','AquaLux',1,'Moderan rimless WC set, lako održavanje i tiho zatvaranje.','["🚽", "🚿"]','[["Tip", "Rimless"], ["Materijal", "Sanitarna keramika"], ["Daska", "Soft-close"], ["Garancija", "5 godina"]]',14,28,7,1,3,2,4.8,'','🚽','2026-09-28 13:47:09.819');
INSERT IGNORE INTO products (id,name,description,group_name,sku,barcode,unit,pack_qty,pack_name,vp_price,mp_price,old_price,sale_until,brand,is_new,long_desc,gallery_json,specs_json,stock,weight_kg,action_discount,special_discount,advance_discount,logistics_discount,rating,image,icon,created_at) VALUES ('p_3','ThermoPro Heat 24 kW','Kondenzacioni gasni kotao za domaćinstva.','Grejanje','TP-H24','8600000000035','kom',1,'kom',78000,99500,109900,'2026-10-31 23:59','ThermoPro',0,'Kondenzacioni kotao 24 kW sa visokim stepenom iskorišćenja.','["🔥", "♨️"]','[["Snaga", "24 kW"], ["Tip", "Kondenzacioni"], ["Efikasnost", "A"], ["Garancija", "5 godina"]]',8,34,4,0,4,2,4.7,'','🔥','2026-09-28 13:47:09.819');
INSERT IGNORE INTO products (id,name,description,group_name,sku,barcode,unit,pack_qty,pack_name,vp_price,mp_price,old_price,sale_until,brand,is_new,long_desc,gallery_json,specs_json,stock,weight_kg,action_discount,special_discount,advance_discount,logistics_discount,rating,image,icon,created_at) VALUES ('p_4','BauMix Flex 25 kg','Fleksibilni lepak za keramiku, C2TE S1.','Lepkovi i mase','BM-FLEX25','8600000000042','džak',25,'kg',880,1290,0,NULL,'BauMix',0,'Fleksibilni cementni lepak za unutrašnju i spoljašnju upotrebu.','["🪣", "🧱"]','[["Klasa", "C2TE S1"], ["Pakovanje", "25 kg"], ["Boja", "Siva"], ["Potrošnja", "3–5 kg/m²"]]',300,25,3,0,3,2,4.6,'','🪣','2026-09-28 13:47:09.819');
INSERT IGNORE INTO products (id,name,description,group_name,sku,barcode,unit,pack_qty,pack_name,vp_price,mp_price,old_price,sale_until,brand,is_new,long_desc,gallery_json,specs_json,stock,weight_kg,action_discount,special_discount,advance_discount,logistics_discount,rating,image,icon,created_at) VALUES ('p_5','ElektroDom Wash 9 kg','Veš mašina sa inverter motorom.','Bela Tehnika','ED-WM900','8600000000059','kom',1,'kom',42000,55990,61990,'2026-09-30 23:59','ElektroDom',1,'Energetski efikasna veš mašina 9 kg sa inverter motorom.','["🫧", "🧺"]','[["Kapacitet", "9 kg"], ["Motor", "Inverter"], ["Energetska klasa", "A"], ["Garancija", "5 godina"]]',7,62,6,0,3,2,4.5,'','🫧','2026-09-28 13:47:09.819');
INSERT IGNORE INTO products (id,name,description,group_name,sku,barcode,unit,pack_qty,pack_name,vp_price,mp_price,old_price,sale_until,brand,is_new,long_desc,gallery_json,specs_json,stock,weight_kg,action_discount,special_discount,advance_discount,logistics_discount,rating,image,icon,created_at) VALUES ('p_6','AquaLux Square Shower 90','Tuš kabina kvadratna 90×90 cm.','Sanitarija','AL-SQ-90','8600000000066','kom',1,'kom',16800,22990,24990,'2026-12-15 23:59','AquaLux',0,'Kaljeno staklo 6 mm, crni mat profil, reverzibilna montaža.','["🚿", "⬛"]','[["Dimenzije", "90×90 cm"], ["Staklo", "6 mm"], ["Profil", "Crni mat"], ["Garancija", "2 godine"]]',22,45,5,1,3,2,4.9,'','🚿','2026-09-28 13:47:09.819');
INSERT IGNORE INTO products (id,name,description,group_name,sku,barcode,unit,pack_qty,pack_name,vp_price,mp_price,old_price,sale_until,brand,is_new,long_desc,gallery_json,specs_json,stock,weight_kg,action_discount,special_discount,advance_discount,logistics_discount,rating,image,icon,created_at) VALUES ('p_7','StoneTech XL Concrete 120×60','Veliki format, industrijski izgled.','Pločice','ST-CON-1260','8600000000073','m²',1.44,'kutija',2900,3890,4290,'2026-10-15 23:59','StoneTech XL',1,'Veliki format gres pločice sa betonskim efektom.','["🧱", "🏗️"]','[["Dimenzije", "120×60 cm"], ["Površina", "Mat"], ["Klasa", "PEI IV"], ["Debljina", "10 mm"]]',56,24,8,0,3,2,4.8,'','🏗️','2026-09-28 13:47:09.819');
INSERT IGNORE INTO products (id,name,description,group_name,sku,barcode,unit,pack_qty,pack_name,vp_price,mp_price,old_price,sale_until,brand,is_new,long_desc,gallery_json,specs_json,stock,weight_kg,action_discount,special_discount,advance_discount,logistics_discount,rating,image,icon,created_at) VALUES ('p_8','ThermoPro Radiator 600/1200','Panelni čelični radijator.','Grejanje','TP-RAD-612','8600000000080','kom',1,'kom',10900,14990,0,NULL,'ThermoPro',0,'Panelni radijator za etažno i centralno grejanje.','["♨️", "🔧"]','[["Visina", "600 mm"], ["Dužina", "1200 mm"], ["Tip", "22"], ["Garancija", "5 godina"]]',48,31,0,0,3,2,4.4,'','♨️','2026-09-28 13:47:09.819');
INSERT IGNORE INTO coupons (id,code,description,type,value,min_amount,max_uses,used,valid_until) VALUES ('cp_1','DOBRODOSLI10','10% za novu Web Shop porudžbinu','%',10,10000,100,0,'2026-12-31');
INSERT IGNORE INTO coupons (id,code,description,type,value,min_amount,max_uses,used,valid_until) VALUES ('cp_2','DOM500','500 RSD popusta preko 5000 RSD','RSD',500,5000,50,0,'2026-11-30');
INSERT IGNORE INTO courier_settings (id,free_from,def_weight) VALUES (1,50000,1);
INSERT IGNORE INTO courier_zones (kg,price) VALUES (2,350);
INSERT IGNORE INTO courier_zones (kg,price) VALUES (5,450);
INSERT IGNORE INTO courier_zones (kg,price) VALUES (10,600);
INSERT IGNORE INTO courier_zones (kg,price) VALUES (20,900);
INSERT IGNORE INTO courier_zones (kg,price) VALUES (50,1600);
INSERT IGNORE INTO courier_zones (kg,price) VALUES (100,3000);
INSERT IGNORE INTO courier_zones (kg,price) VALUES (150,4500);
INSERT IGNORE INTO sale_banner (id,active,title,text,cta,bg) VALUES (1,1,'🌞 LETNJA AKCIJA','Do 30. septembra — posebni popusti na odabrane artikle','Pogledaj akcije','#0c0c0c');
INSERT IGNORE INTO locations (id,name,phone,address,hours,lat,lng) VALUES ('loc_1','DOM EXTRA — Beograd','+381 11 123 4567','Bulevar Oslobođenja 123, Beograd','Pon–Pet 08–18h · Sub 09–14h',44.7977,20.4612);
INSERT IGNORE INTO reviews (id,product_id,buyer,rating,comment,date,verified) VALUES ('rev_1','p_1','Miloš Jovanović',5,'Odlična pločica i boja uživo izgleda još bolje.','2026-08-13',1);
INSERT IGNORE INTO reviews (id,product_id,buyer,rating,comment,date,verified) VALUES ('rev_2','p_2','Stefan Dimitrijević',5,'Brza isporuka i jednostavno čišćenje.','2026-08-21',1);
INSERT IGNORE INTO reviews (id,product_id,buyer,rating,comment,date,verified) VALUES ('rev_3','p_3','Ana Petrović',4,'Dobar odnos cene i karakteristika.','2026-07-19',1);
INSERT IGNORE INTO qa (id,product_id,question,answer,date) VALUES ('qa_1','p_1','Da li je pločica pogodna za podno grejanje?','Da, proizvod je namenjen i za podno grejanje.','2026-08-10');
INSERT IGNORE INTO qa (id,product_id,question,answer,date) VALUES ('qa_2','p_2','Da li je daska uključena?','Da, soft-close daska je uključena u set.','2026-08-18');


CREATE TABLE IF NOT EXISTS shop_wishlist (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_shop_wishlist_user_product (user_id, product_id),
  INDEX idx_shop_wishlist_user (user_id),
  INDEX idx_shop_wishlist_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
