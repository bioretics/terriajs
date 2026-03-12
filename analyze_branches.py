#!/usr/bin/env python3
"""
Script per analizzare i branch del repository e creare un grafo delle connessioni
tra i branch creati da glughi o FrancescoPazz.
"""

import subprocess
import re
import json
from collections import defaultdict
from typing import Dict, List, Set, Tuple

def run_git_command(cmd: List[str]) -> str:
    """Esegue un comando git e ritorna l'output."""
    try:
        result = subprocess.run(
            ['git'] + cmd,
            cwd='/workspace',
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error running git command: {e}")
        return ""

def get_all_remote_branches() -> List[str]:
    """Ottiene la lista di tutti i branch remoti."""
    output = run_git_command(['branch', '-r'])
    branches = []
    for line in output.split('\n'):
        branch = line.strip()
        if branch and not branch.endswith('HEAD'):
            # Rimuove 'origin/' dal nome
            branch_name = branch.replace('origin/', '')
            branches.append(branch_name)
    return branches

def get_branch_author(branch: str) -> Tuple[str, str]:
    """Ottiene l'autore del primo commit di un branch."""
    # Prova prima a vedere se ci sono commit di merge che indicano l'autore
    # Cerca commit di merge che menzionano il branch
    cmd = ['log', f'origin/{branch}', '--format=%an|%ae|%s', '--grep=Merge', '-10']
    output = run_git_command(cmd)
    if output:
        for line in output.split('\n'):
            if line and '|' in line:
                parts = line.split('|', 2)
                if len(parts) >= 2:
                    # Se il messaggio contiene "into" seguito dal nome del branch, è un merge
                    if len(parts) >= 3 and 'into' in parts[2].lower() and branch.lower() in parts[2].lower():
                        return parts[0], parts[1]
    
    # Altrimenti ottiene il primo commit del branch
    cmd = ['log', f'origin/{branch}', '--format=%an|%ae', '--reverse', '-1']
    output = run_git_command(cmd)
    if output:
        parts = output.split('|')
        if len(parts) >= 2:
            return parts[0], parts[1]
    return "", ""

def is_target_author(name: str, email: str) -> bool:
    """Verifica se l'autore è glughi o FrancescoPazz."""
    name_lower = name.lower()
    email_lower = email.lower()
    
    # Cerca glughi
    if 'glughi' in name_lower or 'glughi' in email_lower or 'giovanni.lughi' in email_lower:
        return True
    
    # Cerca FrancescoPazz o Francesco Pazzaglia
    if 'francesco' in name_lower and ('pazz' in name_lower or 'pazzaglia' in name_lower):
        return True
    if 'francescopazz' in email_lower or 'francesco.pazzaglia' in email_lower:
        return True
    
    return False

def get_branch_parent(branch: str, main_branch: str = 'rer3d_from_8.7.9') -> str:
    """Trova il branch da cui deriva questo branch."""
    # Prova a trovare il merge-base con il branch principale
    try:
        # Ottiene il primo commit del branch
        first_commit = run_git_command(['log', f'origin/{branch}', '--format=%H', '--reverse', '-1'])
        if not first_commit:
            return main_branch
        
        # Trova il merge-base con il branch principale
        merge_base = run_git_command(['merge-base', f'origin/{branch}', f'origin/{main_branch}'])
        
        # Verifica se il primo commit è dopo il merge-base
        # Se sì, il branch deriva dal branch principale
        # Altrimenti, cerca altri branch che potrebbero essere il parent
        
        # Ottiene tutti i branch che contengono il merge-base
        # e che sono stati creati prima di questo branch
        return main_branch  # Per ora semplificato
        
    except Exception as e:
        print(f"Error finding parent for {branch}: {e}")
        return main_branch

def is_ancestor(ancestor: str, descendant: str) -> bool:
    """Verifica se ancestor è un ancestore di descendant."""
    try:
        result = subprocess.run(
            ['git', 'merge-base', '--is-ancestor', ancestor, descendant],
            cwd='/workspace',
            capture_output=True,
            text=True
        )
        return result.returncode == 0
    except:
        return False

def find_branch_parent_from_merge_messages(branch: str, all_branches: List[str], main_branch: str) -> str:
    """Cerca nei messaggi di merge per trovare il branch parent."""
    # Cerca commit di merge che menzionano altri branch
    cmd = ['log', f'origin/{branch}', '--format=%s', '--grep=Merge', '-20']
    output = run_git_command(cmd)
    
    if output:
        for line in output.split('\n'):
            line_lower = line.lower()
            # Cerca pattern come "Merge branch 'X' into Y" o "Merge X into Y"
            for other_branch in all_branches:
                if other_branch == branch or other_branch == main_branch:
                    continue
                # Cerca il nome del branch nel messaggio
                if f"'{other_branch}'" in line or f'"{other_branch}"' in line:
                    # Verifica che il branch esista e sia un parent valido
                    try:
                        merge_base = run_git_command(['merge-base', f'origin/{branch}', f'origin/{other_branch}'])
                        if merge_base:
                            return other_branch
                    except:
                        pass
    
    return None

def find_branch_parents(branch: str, all_branches: List[str], main_branch: str = 'rer3d_from_8.7.9') -> List[str]:
    """Trova i branch da cui potrebbe derivare questo branch."""
    parents = []
    
    # Prima prova a trovare il parent dai messaggi di merge
    parent_from_merge = find_branch_parent_from_merge_messages(branch, all_branches, main_branch)
    if parent_from_merge:
        return [parent_from_merge]
    
    try:
        # Trova il merge-base con il branch principale
        merge_base_main = run_git_command(['merge-base', f'origin/{branch}', f'origin/{main_branch}'])
        if not merge_base_main:
            return [main_branch]
        
        # Ottiene la data del merge-base con il principale
        merge_base_date = run_git_command(['log', '-1', '--format=%ct', merge_base_main])
        merge_base_timestamp = int(merge_base_date) if merge_base_date else 0
        
        best_parent = main_branch
        best_timestamp = merge_base_timestamp
        
        # Per ogni altro branch, verifica se questo branch deriva da esso
        for other_branch in all_branches:
            if other_branch == branch or other_branch == main_branch:
                continue
            
            try:
                # Verifica se il merge-base tra questo branch e l'altro branch
                # è più recente del merge-base con il branch principale
                other_merge_base = run_git_command(['merge-base', f'origin/{branch}', f'origin/{other_branch}'])
                
                if other_merge_base and other_merge_base != merge_base_main:
                    # Verifica se l'altro merge-base è più recente del merge-base principale
                    if is_ancestor(merge_base_main, other_merge_base):
                        # L'altro branch è un parent più recente
                        other_date = run_git_command(['log', '-1', '--format=%ct', other_merge_base])
                        other_timestamp = int(other_date) if other_date else 0
                        if other_timestamp > best_timestamp:
                            best_parent = other_branch
                            best_timestamp = other_timestamp
            except:
                pass
        
        # Aggiungi il parent migliore
        if best_parent:
            parents.append(best_parent)
        else:
            parents.append(main_branch)
            
    except Exception as e:
        # In caso di errore, usa il branch principale come default
        parents = [main_branch]
    
    return parents

def analyze_branches():
    """Analizza tutti i branch e crea il grafo delle connessioni."""
    print("Analizzando i branch...")
    
    all_branches = get_all_remote_branches()
    print(f"Trovati {len(all_branches)} branch remoti")
    
    target_branches = {}
    main_branch = 'rer3d_from_8.7.9'
    
    # Filtra i branch creati da glughi o FrancescoPazz
    for branch in all_branches:
        if branch == main_branch:
            continue
            
        author_name, author_email = get_branch_author(branch)
        if is_target_author(author_name, author_email):
            target_branches[branch] = {
                'author': author_name,
                'email': author_email
            }
    
    print(f"Trovati {len(target_branches)} branch creati da glughi o FrancescoPazz")
    
    # Trova le connessioni tra i branch
    connections = defaultdict(list)
    branch_list = list(target_branches.keys())
    
    print("Analizzando le connessioni tra i branch...")
    for i, branch in enumerate(branch_list):
        if (i + 1) % 10 == 0:
            print(f"  Processati {i + 1}/{len(branch_list)} branch...")
        
        # Trova i parent di questo branch
        parents = find_branch_parents(branch, branch_list + [main_branch], main_branch)
        
        # Filtra solo i parent che sono branch target o il branch principale
        filtered_parents = [p for p in parents if p in target_branches or p == main_branch]
        
        if filtered_parents:
            connections[branch] = filtered_parents
        else:
            connections[branch] = [main_branch]
    
    return target_branches, connections, main_branch

def generate_dot_graph(target_branches: Dict, connections: Dict[str, List[str]], main_branch: str):
    """Genera un file DOT per Graphviz."""
    dot_content = ['digraph BranchConnections {', '  rankdir=TB;', '  node [shape=box, style=rounded];', '']
    
    # Aggiunge il branch principale
    dot_content.append(f'  "{main_branch}" [label="{main_branch}\\n(MAIN)", fillcolor=lightblue, style="filled,rounded"];')
    dot_content.append('')
    
    # Aggiunge i branch target
    for branch, info in target_branches.items():
        author_short = 'glughi' if 'glughi' in info['email'].lower() or 'glughi' in info['author'].lower() else 'FrancescoPazz'
        color = 'lightgreen' if author_short == 'glughi' else 'lightyellow'
        dot_content.append(f'  "{branch}" [label="{branch}\\n({author_short})", fillcolor={color}, style="filled,rounded"];')
    
    dot_content.append('')
    
    # Aggiunge le connessioni
    for branch, parents in connections.items():
        for parent in parents:
            dot_content.append(f'  "{parent}" -> "{branch}";')
    
    dot_content.append('}')
    
    return '\n'.join(dot_content)

def generate_markdown_report(target_branches: Dict, connections: Dict[str, List[str]], main_branch: str):
    """Genera un report in formato Markdown."""
    lines = ['# Grafo delle Connessioni tra Branch', '']
    lines.append(f'**Branch principale:** `{main_branch}`\n')
    lines.append(f'**Branch analizzati:** {len(target_branches)}\n')
    
    # Raggruppa per autore
    glughi_branches = []
    francesco_branches = []
    
    for branch, info in target_branches.items():
        if 'glughi' in info['email'].lower() or 'glughi' in info['author'].lower():
            glughi_branches.append(branch)
        else:
            francesco_branches.append(branch)
    
    lines.append('## Branch per Autore\n')
    lines.append(f'### glughi ({len(glughi_branches)} branch)')
    for branch in sorted(glughi_branches):
        lines.append(f'- `{branch}`')
    lines.append('')
    
    lines.append(f'### FrancescoPazz ({len(francesco_branches)} branch)')
    for branch in sorted(francesco_branches):
        lines.append(f'- `{branch}`')
    lines.append('')
    
    lines.append('## Connessioni\n')
    lines.append('```')
    for branch, parents in sorted(connections.items()):
        for parent in parents:
            lines.append(f'{parent} -> {branch}')
    lines.append('```')
    
    return '\n'.join(lines)

if __name__ == '__main__':
    target_branches, connections, main_branch = analyze_branches()
    
    # Genera il file DOT
    dot_content = generate_dot_graph(target_branches, connections, main_branch)
    with open('/workspace/branch_graph.dot', 'w') as f:
        f.write(dot_content)
    print(f"\nFile DOT generato: branch_graph.dot")
    
    # Genera il report Markdown
    md_content = generate_markdown_report(target_branches, connections, main_branch)
    with open('/workspace/branch_graph_report.md', 'w') as f:
        f.write(md_content)
    print(f"Report Markdown generato: branch_graph_report.md")
    
    # Salva anche i dati in JSON
    data = {
        'main_branch': main_branch,
        'branches': target_branches,
        'connections': connections
    }
    with open('/workspace/branch_graph_data.json', 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Dati JSON salvati: branch_graph_data.json")
