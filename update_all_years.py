import pandas as pd
import json
import os

def process_data():
    csv_file = 'Especializadas.csv'
    json_file = 'data.json'

    if not os.path.exists(csv_file):
        print(f"Erro: Arquivo {csv_file} não encontrado.")
        return

    print("Lendo CSV Judicial...")
    df = pd.read_csv(csv_file, encoding='utf-8')

    # Limpeza básica
    df = df.dropna(subset=['Ano'])
    df['Ano'] = df['Ano'].astype(int)

    # Filtrar anos desejados (1997 a 2026)
    df = df[(df['Ano'] >= 1997) & (df['Ano'] <= 2026)]

    print(f"Processando {len(df)} registros judiciais...")

    global_by_year = {}
    dimensions = {
        'Especializada': {'totals': {}, 'by_year': {}}
    }

    for _, row in df.iterrows():
        ano = str(row['Ano'])
        esp = str(row['Especializada'])
        
        if pd.isna(row['Especializada']) or esp.strip() == '':
            continue
            
        classe = str(row['Classe']) if not pd.isna(row['Classe']) else "A Definir"
        assunto = str(row['Assunto']) if not pd.isna(row['Assunto']) else "A Definir"
        
        # Agregado Global
        if ano not in global_by_year:
            global_by_year[ano] = {'total': 0, 'classes': {}, 'assuntos': {}, 'comarcas': {}}
        
        comarca = str(row['Comarca']) if not pd.isna(row['Comarca']) else "Desconhecida"

        global_by_year[ano]['total'] += 1
        global_by_year[ano]['classes'][classe] = global_by_year[ano]['classes'].get(classe, 0) + 1
        global_by_year[ano]['assuntos'][assunto] = global_by_year[ano]['assuntos'].get(assunto, 0) + 1
        global_by_year[ano]['comarcas'][comarca] = global_by_year[ano]['comarcas'].get(comarca, 0) + 1
        
        # Especializada Dimension
        dim_data = dimensions['Especializada']
        dim_data['totals'][esp] = dim_data['totals'].get(esp, 0) + 1
        
        if esp not in dim_data['by_year']:
            dim_data['by_year'][esp] = {}
        if ano not in dim_data['by_year'][esp]:
            dim_data['by_year'][esp][ano] = {'total': 0, 'classes': {}, 'assuntos': {}, 'comarcas': {}}
            
        y_data = dim_data['by_year'][esp][ano]
        y_data['total'] += 1
        y_data['classes'][classe] = y_data['classes'].get(classe, 0) + 1
        y_data['assuntos'][assunto] = y_data['assuntos'].get(assunto, 0) + 1
        y_data['comarcas'][comarca] = y_data['comarcas'].get(comarca, 0) + 1

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
    process_data()
