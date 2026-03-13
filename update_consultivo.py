import pandas as pd
import json
import os

def process_consultivo_data():
    csv_file = 'processos_consultivos.csv'
    json_file = 'data_consultivo.json'

    if not os.path.exists(csv_file):
        print(f"Erro: Arquivo {csv_file} não encontrado.")
        return

    print("Lendo CSV Consultivo...")
    try:
        df = pd.read_csv(csv_file, encoding='utf-8')
    except UnicodeDecodeError:
        df = pd.read_csv(csv_file, encoding='latin1')

    # Limpeza básica
    df = df.dropna(subset=['Ano'])
    df['Ano'] = pd.to_numeric(df['Ano'], errors='coerce')
    df = df.dropna(subset=['Ano'])
    df['Ano'] = df['Ano'].astype(int)

    # Filtrar anos desejados (1997 a 2026)
    df = df[(df['Ano'] >= 1997) & (df['Ano'] <= 2026)]

    print(f"Processando {len(df)} registros consultivos...")

    global_by_year = {}
    
    dimensions = {
        'Origem': {'totals': {}, 'by_year': {}},
        'Área': {'totals': {}, 'by_year': {}}
    }

    for _, row in df.iterrows():
        ano = str(row['Ano'])
        origem = str(row['Origem']) if not pd.isna(row['Origem']) else "Não Informado"
        area = str(row['Área']) if not pd.isna(row['Área']) else "A Definir"
        assunto = str(row['Assunto']) if not pd.isna(row['Assunto']) else "A Definir"
        
        # Agregado Global
        if ano not in global_by_year:
            global_by_year[ano] = {'total': 0, 'classes': {}, 'assuntos': {}}
        
        global_by_year[ano]['total'] += 1
        global_by_year[ano]['classes'][area] = global_by_year[ano]['classes'].get(area, 0) + 1
        global_by_year[ano]['assuntos'][assunto] = global_by_year[ano]['assuntos'].get(assunto, 0) + 1
        
        # Dimension: Origem (Classes slot stores Área)
        dim_origem = dimensions['Origem']
        dim_origem['totals'][origem] = dim_origem['totals'].get(origem, 0) + 1
        if origem not in dim_origem['by_year']:
            dim_origem['by_year'][origem] = {}
        if ano not in dim_origem['by_year'][origem]:
            dim_origem['by_year'][origem][ano] = {'total': 0, 'classes': {}, 'assuntos': {}}
        dim_origem['by_year'][origem][ano]['total'] += 1
        dim_origem['by_year'][origem][ano]['classes'][area] = dim_origem['by_year'][origem][ano]['classes'].get(area, 0) + 1
        dim_origem['by_year'][origem][ano]['assuntos'][assunto] = dim_origem['by_year'][origem][ano]['assuntos'].get(assunto, 0) + 1

        # Dimension: Área (Classes slot stores Origem)
        dim_area = dimensions['Área']
        dim_area['totals'][area] = dim_area['totals'].get(area, 0) + 1
        if area not in dim_area['by_year']:
            dim_area['by_year'][area] = {}
        if ano not in dim_area['by_year'][area]:
            dim_area['by_year'][area][ano] = {'total': 0, 'classes': {}, 'assuntos': {}}
        dim_area['by_year'][area][ano]['total'] += 1
        dim_area['by_year'][area][ano]['classes'][origem] = dim_area['by_year'][area][ano]['classes'].get(origem, 0) + 1
        dim_area['by_year'][area][ano]['assuntos'][assunto] = dim_area['by_year'][area][ano]['assuntos'].get(assunto, 0) + 1

    # Objeto final
    output_data = {
        'global_by_year': global_by_year,
        'dimensions': dimensions
    }

    print(f"Salvando dados em {json_file}...")
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print("Sucesso!")

if __name__ == "__main__":
    process_consultivo_data()
