UPDATE public.employees SET full_name = CASE id
  WHEN '5d7f61f1-2fd7-4eae-85ed-f6d0898b321c' THEN 'أحمد عبدالله محمد'
  WHEN '51800b21-57bf-4bcc-8681-3600d18d2b5f' THEN 'نورة سعيد علي'
  WHEN 'e80d43d4-1299-4b6c-ab92-9b7f994376db' THEN 'خالد محمد أحمد'
  WHEN '8e2200e6-f5d5-462c-bfde-7db6e967df89' THEN 'سارة فهد عبدالرحمن'
  WHEN '2ce509a3-e1be-47ec-833b-11b16a599c46' THEN 'ماجد علي حسن'
  WHEN '2444f9ef-b00f-405e-a323-11ae1eb4a2f8' THEN 'ريم ناصر سالم'
  WHEN '5a2da95e-20a0-43bb-b61a-d96dadd6f098' THEN 'فيصل بدر إبراهيم'
  WHEN 'bef1ac4d-6887-41c7-8522-a0192c4e530a' THEN 'ليلى عمر يوسف'
  WHEN '642c005e-75b2-470e-b7fc-c5baedc66057' THEN 'بدر حمد سليمان'
  WHEN '1f89d851-9d12-4636-8cf1-4a70e9e8eaf1' THEN 'هدى خالد عبدالله'
  WHEN '321f0c55-04f3-47d0-b138-601bd87b6d7b' THEN 'تركي صالح موسى'
  WHEN '30c086aa-b3c5-4076-9f02-f5ed767c29ef' THEN 'منى يوسف إبراهيم'
END
WHERE organization_id = '00000000-0000-0000-0000-0000000000de'
  AND id IN (
    '5d7f61f1-2fd7-4eae-85ed-f6d0898b321c','51800b21-57bf-4bcc-8681-3600d18d2b5f',
    'e80d43d4-1299-4b6c-ab92-9b7f994376db','8e2200e6-f5d5-462c-bfde-7db6e967df89',
    '2ce509a3-e1be-47ec-833b-11b16a599c46','2444f9ef-b00f-405e-a323-11ae1eb4a2f8',
    '5a2da95e-20a0-43bb-b61a-d96dadd6f098','bef1ac4d-6887-41c7-8522-a0192c4e530a',
    '642c005e-75b2-470e-b7fc-c5baedc66057','1f89d851-9d12-4636-8cf1-4a70e9e8eaf1',
    '321f0c55-04f3-47d0-b138-601bd87b6d7b','30c086aa-b3c5-4076-9f02-f5ed767c29ef'
  );