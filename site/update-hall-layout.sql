-- Обновление схемы зала BALI по утверждённой раскладке.
-- Выполните после основного файла supabase-schema.sql.
-- Вместимость сейчас задана предварительно и редактируется в админ-панели.

insert into public.hall_tables(id,name,seats,x,y,shape,active)
values
  ('table-1','Стол 1',4,26.5,85.0,'vip',true),
  ('table-2','Стол 2',6,18.6,86.0,'vip',true),
  ('table-3','Стол 3',6,10.7,84.0,'vip',true),
  ('table-4','Стол 4',6,9.4,74.0,'vip',true),
  ('table-5','Стол 5',6,17.0,74.0,'vip',true),
  ('table-6','Стол 6',6,60.5,83.0,'vip',true),
  ('table-7','Стол 7',4,18.4,58.0,'square',true),
  ('table-8','Стол 8',4,18.4,46.0,'square',true),
  ('table-9','Стол 9',6,20.0,30.0,'vip',true),
  ('table-10','Стол 10',4,25.5,23.5,'square',true),
  ('table-11','Стол 11',6,33.0,14.5,'vip',true),
  ('table-12','Стол 12',4,34.2,45.2,'square',true),
  ('table-13','Стол 13',4,34.5,58.0,'square',true),
  ('table-14','Стол 14',4,77.2,68.2,'square',true),
  ('table-15','Стол 15',4,81.0,62.0,'square',true),
  ('table-16','Стол 16',4,81.5,53.0,'square',true),
  ('table-17','Стол 17',4,81.0,43.5,'square',true),
  ('table-18','Стол 18',4,77.5,36.0,'square',true),
  ('table-19','Стол 19',8,82.5,12.5,'vip',true),
  ('table-20','Стол 20',6,61.5,24.5,'vip',true),
  ('table-21','Стол 21',6,61.0,11.5,'vip',true),
  ('table-23','Стол 23',6,54.5,11.5,'vip',true),
  ('table-24','Стол 24',6,46.5,11.5,'vip',true),
  ('table-25','Стол 25',6,46.5,24.5,'vip',true),
  ('table-26','Стол 26',4,42.0,83.5,'square',true)
on conflict (id) do update set
  name = excluded.name,
  seats = excluded.seats,
  x = excluded.x,
  y = excluded.y,
  shape = excluded.shape,
  active = excluded.active;

-- На предоставленной схеме отсутствует стол №22.
update public.hall_tables
set active = false
where id not in ('table-1', 'table-2', 'table-3', 'table-4', 'table-5', 'table-6', 'table-7', 'table-8', 'table-9', 'table-10', 'table-11', 'table-12', 'table-13', 'table-14', 'table-15', 'table-16', 'table-17', 'table-18', 'table-19', 'table-20', 'table-21', 'table-23', 'table-24', 'table-25', 'table-26');
