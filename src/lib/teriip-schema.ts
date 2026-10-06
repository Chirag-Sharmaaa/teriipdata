export type ParameterCategory =
  | "Identity"
  | "Haematology"
  | "Metabolic"
  | "Thyroid"
  | "Liver & renal"
  | "Electrolytes & enzymes"
  | "Vitamins & minerals";

export type Parameter = {
  name: string;
  category: ParameterCategory;
  unit?: string;
  aliases?: string[];
  kind: "text" | "number";
};

const group = (
  category: ParameterCategory,
  names: Array<[string, string?, string[]?]>,
): Parameter[] =>
  names.map(([name, unit, aliases]) => ({
    name,
    category,
    ...(unit ? { unit } : {}),
    ...(aliases ? { aliases } : {}),
    kind: ["Name", "Gender", "Blood Group", "PBS"].includes(name) ? "text" : "number",
  }));

export const COMMON_PARAMETERS: Parameter[] = [
  ...group("Identity", [
    ["RecordID"], ["Name"], ["AGE", "years", ["Age"]], ["Gender"], ["Blood Group"],
  ]),
  ...group("Haematology", [
    ["Hb"], ["PCV"], ["TRBC"], ["MCV"], ["MCH"], ["MCHC"], ["RDW"], ["TLC"],
    ["Neutrophil"], ["Lymphocyte"], ["Monocyte"], ["Eosinophil"], ["Basophil"], ["Platelet_Count"], ["MPV"],
    ["Abs_Neutrophil"], ["Abs_Lymphocyte"], ["Abs_Monocyte"], ["Abs_Eosinophil"], ["Abs_Basophil"], ["ESR"], ["Reticulocyte"],
  ]),
  ...group("Metabolic", [
    ["Glucose_Fasting mg/dl", "mg/dl", ["Glucose(mg/dl)"]], ["HbA1c%", "%", ["HbA1c(%)"]],
    ["Total_Cholesterol mg/dl", "mg/dl"], ["HDL mg/dl", "mg/dl"], ["LDL mg/dl", "mg/dl"], ["Triglycerides mg/dl", "mg/dl"],
  ]),
  ...group("Thyroid", [
    ["TSH μIU/mL", "μIU/mL"], ["FT3"], ["FT4 pmo/L", "pmo/L"], ["T3_Total ng/dl", "ng/dl"], ["T4_Total μg/dl", "μg/dl"],
    ["Anti_TPO IU/mL", "IU/mL", ["TPO"]], ["Anti_Thyroglobulin IU/mL", "IU/mL", ["Thyroglobulin Ab"]],
  ]),
  ...group("Liver & renal", [
    ["Bilirubin_Total mg/dl", "mg/dl"], ["Bilirubin_Direct mg/dl", "mg/dl"], ["Bilirubin_Indirect mg/dl", "mg/dl"],
    ["AST U/L", "U/L", ["AST/SGOT(IU/L)"]], ["ALT U/L", "U/L", ["ALT/SGPT(IU/L)"]], ["ALP U/L", "U/L"], ["GGT U/L", "U/L"],
    ["Total_Protein g/dL", "g/dL"], ["Albumin g/dL", "g/dL"], ["Globulin gm/dL", "gm/dL"], ["Urea mg/dL", "mg/dL"],
    ["Creatinine mg/dL", "mg/dL"], ["Uric_Acid mg/dL", "mg/dL"],
  ]),
  ...group("Electrolytes & enzymes", [
    ["Sodium mMol/L", "mMol/L"], ["Potassium mMol/L", "mMol/L"], ["Chloride mMol/L", "mMol/L"], ["Calcium mg/dL", "mg/dL"],
    ["Phosphorus mg/dL", "mg/dL"], ["Magnesium mEq/L", "mEq/L"], ["Amylase U/L", "U/L"], ["Lipase U/L", "U/L"], ["CRP mg/L", "mg/L"],
  ]),
  ...group("Vitamins & minerals", [
    ["Iron μg/dl", "μg/dl"], ["Ferritin ng/ml", "ng/ml"], ["TIBC μg/dl", "μg/dl"], ["TFR_Saturation %", "%"],
    ["Vitamin_B12 pg/ml", "pg/ml"], ["Vitamin_D ng/ml", "ng/ml"], ["Folate ng/ml", "ng/ml"], ["Copper ug/dl", "ug/dl"],
    ["Zinc ug/dl", "ug/dl"], ["PBS"],
  ]),
];

export const CENTRE_EXTENSIONS: Parameter[] = [
  { name: "MRD No", category: "Identity", kind: "text", aliases: ["MRD Number"] },
  { name: "ABO & Rh Blood grouping", category: "Identity", kind: "text", aliases: ["ABO & Rh", "Blood grouping"] },
];

export const TERIIP_CENTRES = [
  "AIIMS Bhopal", "Bhatinda", "Delhi", "Guwahati", "Jodhpur", "Raipur", "Kalyani", "Amrita Kochi",
  "BCCI Guwahati", "NIRRH Port Blair", "JSS Mysore", "KGMU Lucknow", "KIMS Bhubaneswar", "KMC Manipal",
  "P D Hinduja", "PGIMER Chandigarh",
] as const;

export const parameterByName = new Map(COMMON_PARAMETERS.map((parameter) => [parameter.name, parameter]));