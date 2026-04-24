-- جمعية حرف
UPDATE organization_profiles SET
  instagram_url = 'https://www.instagram.com/craftsassoc/',
  youtube_url = 'https://www.youtube.com/@harf2325',
  tiktok_url = 'https://www.tiktok.com/@harf2325',
  snapchat_url = 'https://www.snapchat.com/@hrfard23'
WHERE organization_id = '5f619813-3478-4f21-a22e-8146fda7a495';

-- جمعية دعوة القصبة
UPDATE organization_profiles SET
  snapchat_url = 'https://www.snapchat.com/add/dawanqb'
WHERE organization_id = 'a7e4df20-5558-484f-9f4b-814c8b2dc082';

-- جمعية سكينة
UPDATE organization_profiles SET
  youtube_url = 'https://www.youtube.com/@Skinah2024',
  tiktok_url = 'https://www.tiktok.com/@skinah2024'
WHERE organization_id = 'dc901f7e-e76e-41e8-9aa0-09998e3a3d6a';

-- جمعية صواب
UPDATE organization_profiles SET
  tiktok_url = 'https://www.tiktok.com/@sawabjazan',
  snapchat_url = 'https://www.snapchat.com/add/sawabjazan'
WHERE organization_id = 'a8a8aa31-3247-4cbe-b9e3-489e066fc941';

-- جمعية عطاء (إضافة تويتر وسناب الرسميين الموثقين)
UPDATE organization_profiles SET
  twitter_url = 'https://x.com/ataa_912',
  snapchat_url = 'https://www.snapchat.com/add/ataa_org',
  youtube_url = 'https://www.youtube.com/@Ataa-912'
WHERE organization_id = '77ad74f3-d35c-4bc3-b7cd-ee927b9c717a';

-- جمعية مآثر
UPDATE organization_profiles SET
  youtube_url = 'https://www.youtube.com/user/dalardha',
  tiktok_url = 'https://www.tiktok.com/@dawardah0'
WHERE organization_id = '25e17864-ca4d-4dd5-8f92-16da4986d8d3';

-- جمعية نجباء
UPDATE organization_profiles SET
  youtube_url = 'https://www.youtube.com/channel/UCz_h0mhEHpNKIJ7kkuZuwcw',
  snapchat_url = 'https://www.snapchat.com/add/nujab_a'
WHERE organization_id = '5efaaebe-0ec0-4b7c-94b3-ad8a9e05a7ad';

-- جمعية عطف: إزالة Twitter atef5245 إن لم يكن للجمعية، نتركه كما هو وإضافة فقط ما تأكدنا منه (لا شيء جديد موثق)
-- لا نضيف tabukpaws أو ahd-almsarha لأنها ليست للجمعية