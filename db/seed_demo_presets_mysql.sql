-- Demo seed for chairman requirement presets (MySQL)
-- Apply after Admin+Master schema tables are created (column names may need alignment with actual entities).

-- Doctors (example)
-- INSERT INTO master_staff_profile(name_ko, role_code, dept_name, active) VALUES
-- ('이순신','DOC','내과',1),('김시민','DOC','외과',1),('박혁거세','DOC','영상의학과',1);

-- Admin staff (example)
-- INSERT INTO master_staff_profile(name_ko, role_code, dept_name, active) VALUES
-- ('원무1','ADM','원무과',1),('원무2','ADM','원무과',1);

-- Medication presets (example code table)
-- INSERT INTO master_code_item(code_set_key, item_code, item_name) VALUES
-- ('MEDICATION_PRESET','MED_001','아세트아미노펜'),
-- ('MEDICATION_PRESET','MED_002','이부프로펜'),
-- ('MEDICATION_PRESET','MED_003','나프록센'),
-- ('MEDICATION_PRESET','MED_004','판토프라졸'),
-- ('MEDICATION_PRESET','MED_005','알마게이트'),
-- ('MEDICATION_PRESET','MED_006','돔페리돈'),
-- ('MEDICATION_PRESET','MED_007','세티리진'),
-- ('MEDICATION_PRESET','MED_008','암로디핀'),
-- ('MEDICATION_PRESET','MED_009','로수바스타틴'),
-- ('MEDICATION_PRESET','MED_010','에스시탈로프람');
