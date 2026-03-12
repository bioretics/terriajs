#!/usr/bin/env python3
"""
Script per analizzare i branch di un repository git e creare un grafo delle connessioni.
"""

import subprocess
import json
import re
from collections import defaultdict
from datetime import datetime

def run_git_command(cmd):
    """Esegue un comando git e ritorna l'output."""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Errore eseguendo: {cmd}")
        print(f"Errore: {e.stderr}")
        return ""

def get_all_branches():
    """Ottiene tutti i branch (locali e remoti)."""
    branches = []
    output = run_git_command("git branch -a")
    for line in output.split('\n'):
        line = line.strip()
        if not line or line.startswith('*'):
            continue
        # Rimuove "remotes/" dal nome
        branch = line.replace('remotes/origin/', '').replace('remotes/', '')
        if branch and branch not in branches:
            branches.append(branch)
    return sorted(branches)

def get_branch_commit(branch):
    """Ottiene il commit più recente di un branch."""
    try:
        # Prova prima con origin/
        commit = run_git_command(f"git rev-parse origin/{branch} 2>/dev/null || git rev-parse {branch} 2>/dev/null")
        if commit:
            return commit
    except:
        pass
    return None

def get_merge_base(branch1, branch2):
    """Trova il merge-base tra due branch."""
    try:
        base = run_git_command(f"git merge-base origin/{branch1} origin/{branch2} 2>/dev/null || git merge-base {branch1} {branch2} 2>/dev/null")
        if base:
            return base
    except:
        pass
    return None

def get_branch_merges(branch):
    """Trova i merge commit che coinvolgono questo branch."""
    merges = []
    try:
        # Cerca merge commit che menzionano questo branch
        log_output = run_git_command(
            f"git log --all --merges --format='%H|%P|%D' --grep='{branch}' 2>/dev/null | head -20"
        )
        for line in log_output.split('\n'):
            if line and branch in line:
                parts = line.split('|')
                if len(parts) >= 2:
                    merges.append({
                        'commit': parts[0],
                        'parents': parts[1].split() if parts[1] else []
                    })
    except:
        pass
    return merges

def find_branch_relationships(branches):
    """Trova le relazioni tra i branch."""
    relationships = defaultdict(list)
    branch_commits = {}
    
    print(f"Analizzando {len(branches)} branch...")
    
    # Ottieni i commit per ogni branch
    for i, branch in enumerate(branches):
        if i % 50 == 0:
            print(f"  Processati {i}/{len(branches)} branch...")
        commit = get_branch_commit(branch)
        if commit:
            branch_commits[branch] = commit
    
    print(f"Trovati {len(branch_commits)} branch con commit validi.")
    print("Analizzando le relazioni tra branch...")
    
    # Trova i branch principali (v8, main, master)
    main_branches = [b for b in branches if b in ['v8', 'main', 'master', 'origin/v8', 'origin/main', 'origin/master']]
    
    # Per ogni branch, trova da quale branch principale deriva
    for i, branch in enumerate(branch_commits.keys()):
        if i % 20 == 0:
            print(f"  Analizzati {i}/{len(branch_commits)} branch...")
        
        if branch in main_branches:
            continue
            
        # Trova il merge-base con i branch principali
        best_match = None
        best_distance = float('inf')
        
        for main_branch in main_branches:
            if main_branch not in branch_commits:
                continue
            merge_base = get_merge_base(branch, main_branch)
            if merge_base:
                # Calcola la distanza (numero di commit)
                try:
                    distance = int(run_git_command(
                        f"git rev-list --count {merge_base}..origin/{branch} 2>/dev/null || git rev-list --count {merge_base}..{branch} 2>/dev/null"
                    ) or "0")
                    if distance < best_distance:
                        best_distance = distance
                        best_match = main_branch
                except:
                    pass
        
        if best_match:
            relationships[best_match].append(branch)
        else:
            # Se non trova un match con i branch principali, prova con altri branch
            for other_branch in branch_commits.keys():
                if other_branch == branch:
                    continue
                merge_base = get_merge_base(branch, other_branch)
                if merge_base:
                    # Verifica se questo branch deriva dall'altro
                    try:
                        other_commit = branch_commits[other_branch]
                        base_commit = merge_base
                        # Se il merge-base è più vicino all'altro branch, allora questo branch deriva da quello
                        distance_to_other = int(run_git_command(
                            f"git rev-list --count {base_commit}..origin/{other_branch} 2>/dev/null || git rev-list --count {base_commit}..{other_branch} 2>/dev/null"
                        ) or "0")
                        distance_to_this = int(run_git_command(
                            f"git rev-list --count {base_commit}..origin/{branch} 2>/dev/null || git rev-list --count {base_commit}..{branch} 2>/dev/null"
                        ) or "0")
                        if distance_to_other < distance_to_this and distance_to_other < 50:
                            relationships[other_branch].append(branch)
                            break
                    except:
                        pass
    
    return relationships, branch_commits

def create_graph_data(relationships, branch_commits):
    """Crea i dati per il grafo."""
    nodes = []
    edges = []
    
    # Crea i nodi
    all_branches = set(relationships.keys())
    for children in relationships.values():
        all_branches.update(children)
    
    for branch in all_branches:
        node = {
            'id': branch,
            'label': branch.replace('origin/', ''),
            'group': 1 if branch in ['v8', 'main', 'master', 'origin/v8', 'origin/main', 'origin/master'] else 2
        }
        nodes.append(node)
    
    # Crea gli archi
    for parent, children in relationships.items():
        for child in children:
            edges.append({
                'from': parent,
                'to': child
            })
    
    return {'nodes': nodes, 'edges': edges}

def generate_html_visualization(graph_data):
    """Genera una visualizzazione HTML interattiva del grafo."""
    html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Grafo delle Connessioni tra Branch</title>
    <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
    <style>
        body {{
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        #mynetwork {{
            width: 100%;
            height: 800px;
            border: 1px solid #ddd;
            background-color: white;
        }}
        h1 {{
            color: #333;
        }}
        .info {{
            margin-bottom: 20px;
            padding: 10px;
            background-color: #e8f4f8;
            border-radius: 5px;
        }}
    </style>
</head>
<body>
    <h1>Grafo delle Connessioni tra Branch</h1>
    <div class="info">
        <p><strong>Totale branch:</strong> {len(graph_data['nodes'])}</p>
        <p><strong>Totale connessioni:</strong> {len(graph_data['edges'])}</p>
        <p><em>I branch principali (v8, main, master) sono evidenziati in rosso.</em></p>
    </div>
    <div id="mynetwork"></div>
    
    <script type="text/javascript">
        var nodes = new vis.DataSet({json.dumps(graph_data['nodes'])});
        var edges = new vis.DataSet({json.dumps(graph_data['edges'])});
        
        var container = document.getElementById('mynetwork');
        var data = {{
            nodes: nodes,
            edges: edges
        }};
        var options = {{
            nodes: {{
                shape: 'box',
                font: {{
                    size: 12
                }},
                color: {{
                    border: '#2B7CE9',
                    background: '#97C2FC',
                    highlight: {{
                        border: '#2B7CE9',
                        background: '#D2E5FF'
                    }}
                }},
                borderWidth: 2
            }},
            edges: {{
                arrows: {{
                    to: {{
                        enabled: true,
                        scaleFactor: 0.5
                    }}
                }},
                color: {{
                    color: '#848484',
                    highlight: '#848484'
                }}
            }},
            layout: {{
                hierarchical: {{
                    enabled: true,
                    direction: 'UD',
                    sortMethod: 'directed',
                    levelSeparation: 150,
                    nodeSpacing: 200,
                    treeSpacing: 200
                }}
            }},
            physics: {{
                enabled: false
            }}
        }};
        
        var network = new vis.Network(container, data, options);
        
        // Colora i branch principali
        nodes.forEach(function(node) {{
            if (node.group === 1) {{
                nodes.update({{
                    id: node.id,
                    color: {{
                        border: '#FF0000',
                        background: '#FF6B6B',
                        highlight: {{
                            border: '#FF0000',
                            background: '#FFB6B6'
                        }}
                    }}
                }});
            }}
        }});
    </script>
</body>
</html>"""
    return html

def generate_dot_file(graph_data):
    """Genera un file DOT per Graphviz."""
    dot = "digraph branch_connections {\n"
    dot += "    rankdir=TB;\n"
    dot += "    node [shape=box, style=rounded];\n\n"
    
    # Aggiungi i nodi principali con colori diversi
    main_branches = {'v8', 'main', 'master', 'origin/v8', 'origin/main', 'origin/master'}
    for node in graph_data['nodes']:
        branch_id = node['id']
        label = node['label']
        if branch_id in main_branches:
            dot += f'    "{branch_id}" [label="{label}", color=red, fillcolor=lightcoral, style="filled,rounded"];\n'
        else:
            dot += f'    "{branch_id}" [label="{label}"];\n'
    
    dot += "\n"
    
    # Aggiungi gli archi
    for edge in graph_data['edges']:
        dot += f'    "{edge["from"]}" -> "{edge["to"]}";\n'
    
    dot += "}\n"
    return dot

def main():
    print("=" * 60)
    print("Analisi delle connessioni tra branch")
    print("=" * 60)
    
    # Ottieni tutti i branch
    branches = get_all_branches()
    print(f"\nTrovati {len(branches)} branch totali")
    
    # Trova le relazioni
    relationships, branch_commits = find_branch_relationships(branches)
    
    print(f"\nTrovate {len(relationships)} relazioni principali")
    print(f"Totale branch connessi: {sum(len(children) for children in relationships.values())}")
    
    # Crea i dati del grafo
    graph_data = create_graph_data(relationships, branch_commits)
    
    # Genera la visualizzazione HTML
    html_content = generate_html_visualization(graph_data)
    with open('/workspace/grafo_branch.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    print("\n✓ File HTML generato: grafo_branch.html")
    
    # Genera il file DOT
    dot_content = generate_dot_file(graph_data)
    with open('/workspace/grafo_branch.dot', 'w', encoding='utf-8') as f:
        f.write(dot_content)
    print("✓ File DOT generato: grafo_branch.dot")
    
    # Genera un file JSON con i dati
    output_data = {
        'timestamp': datetime.now().isoformat(),
        'total_branches': len(branches),
        'relationships': {k: v for k, v in relationships.items()},
        'graph': graph_data
    }
    with open('/workspace/grafo_branch.json', 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    print("✓ File JSON generato: grafo_branch.json")
    
    print("\n" + "=" * 60)
    print("Analisi completata!")
    print("=" * 60)
    print("\nPer visualizzare il grafo:")
    print("  - Apri grafo_branch.html nel browser")
    print("  - Oppure usa: dot -Tpng grafo_branch.dot -o grafo_branch.png")

if __name__ == "__main__":
    main()
