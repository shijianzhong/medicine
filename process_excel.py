import pandas as pd
import json
import re

def clean_text(text):
    """清理文本数据"""
    if pd.isna(text):
        return ""
    return str(text).strip()

def extract_categories_and_medicines(df, sheet_name):
    """提取分类和药品信息"""
    categories = {}
    medicines = []
    category_stack = []
    
    # 列索引映射
    sheet_col_map = {
        '西药部分':    {'name': [13, 14], 'dosage': 15, 'note': 17},
        '中成药部分': {'name': [13, 14, 15], 'note': [16, 17, 18]},
        '协议西药':   {'name': [12, 13], 'payment_standard': [14, 15, 16], 'note': 17, 'validity_period': 18},
        '协议中成药': {'name': [12, 13], 'payment_standard': [14, 15, 16], 'note': 17, 'validity_period': 18},
        '竞价药品部分': {'name': [12, 13], 'payment_standard': [14, 15, 16], 'note': 17, 'validity_period': 18},
    }
    col_map = sheet_col_map.get(sheet_name, {})
    
    for idx, row in df.iterrows():
        if idx < 2:
            continue
        if row.isna().all():
            continue
        first_col = clean_text(row.iloc[0])
        # 分类行
        if first_col:
            # 分类名称为本行第一个不为空的单元格（从第2列开始）
            cat_name = ''
            for i in range(1, len(row)):
                val = clean_text(row.iloc[i])
                if val:
                    cat_name = val
                    break
            code = first_col
            # 只弹出比当前层级高的栈顶
            while category_stack and len(code) <= len(category_stack[-1][0]):
                category_stack.pop()
            parent_code = category_stack[-1][0] if category_stack else None
            level = len(category_stack) + 1
            categories[code] = {
                'code': code,
                'name': cat_name,
                'level': level,
                'parent_code': parent_code,
                'subcategories': {},
                'medicine_count': 0
            }
            category_stack.append((code, cat_name, level))
            continue
        # 药品行
        name = ''
        if 'name' in col_map:
            for i in col_map['name']:
                n = clean_text(row.iloc[i]) if i < len(row) else ''
                if n:
                    name = n
                    break
        if not name:
            continue
        medicine = {
            'id': f"{sheet_name}_{idx}",
            'name': name,
            'sheet': sheet_name,
        }
        # 分类归属
        if category_stack:
            all_codes = [c[0] for c in category_stack]
            specific_category_code = category_stack[-1][0]
            medicine['category_code'] = specific_category_code
            medicine['category_name'] = categories[specific_category_code]['name']
            medicine['all_category_codes'] = all_codes
            categories[specific_category_code]['medicine_count'] += 1
        # 其它字段
        if 'dosage' in col_map:
            i = col_map['dosage']
            medicine['dosage'] = clean_text(row.iloc[i]) if i < len(row) else ''
        if 'payment_standard' in col_map:
            ps = [clean_text(row.iloc[i]) if i < len(row) else '' for i in col_map['payment_standard']]
            medicine['payment_standard'] = [x for x in ps if x]
        if 'note' in col_map:
            if isinstance(col_map['note'], list):
                notes = [clean_text(row.iloc[i]) if i < len(row) else '' for i in col_map['note']]
                medicine['note'] = '；'.join([x for x in notes if x])
            else:
                i = col_map['note']
                medicine['note'] = clean_text(row.iloc[i]) if i < len(row) else ''
        if 'validity_period' in col_map:
            i = col_map['validity_period']
            medicine['validity_period'] = clean_text(row.iloc[i]) if i < len(row) else ''
        medicines.append(medicine)
    # 构建严格嵌套的分类树
    category_tree = build_category_tree(categories)
    for root in category_tree.values():
        update_medicine_count_recursive(root)
    return {
        'categories': category_tree,
        'medicines': medicines
    }

def build_category_tree(categories):
    # 先构建所有节点
    nodes = {code: dict(cat) for code, cat in categories.items()}
    # 清空所有subcategories
    for node in nodes.values():
        node['subcategories'] = {}
    # 挂载子分类
    tree = {}
    for code, node in nodes.items():
        parent_code = node.get('parent_code')
        if parent_code and parent_code in nodes:
            nodes[parent_code]['subcategories'][code] = node
        else:
            tree[code] = node
    return tree

def update_medicine_count_recursive(node):
    # 本级直接药品数
    direct = node.get('medicine_count', 0)
    # 子分类递归累加
    if node.get('subcategories'):
        sub_total = 0
        for sub in node['subcategories'].values():
            sub_total += update_medicine_count_recursive(sub)
        node['medicine_count'] = direct + sub_total
        return node['medicine_count']
    return direct

def main():
    """主函数"""
    excel_file = 'yao.xlsx'
    
    # 读取所有sheet
    xl = pd.ExcelFile(excel_file)
    for sheet_name in xl.sheet_names:
        print(f"处理 {sheet_name}...")
        df = pd.read_excel(excel_file, sheet_name=sheet_name, header=None)
        sheet_data = extract_categories_and_medicines(df, sheet_name)
        
        # 确保medicines是list[dict]且每个dict都有all_category_codes字段
        if not isinstance(sheet_data['medicines'], list):
            raise ValueError(f"{sheet_name} medicines不是list类型")
        
        for i, medicine in enumerate(sheet_data['medicines']):
            if not isinstance(medicine, dict):
                raise ValueError(f"{sheet_name} 第{i}个药品不是dict类型")
            if 'all_category_codes' not in medicine:
                raise ValueError(f"{sheet_name} 第{i}个药品缺少all_category_codes字段: {medicine}")
        
        # 保存为单独的JSON文件
        output_file = f'src/{sheet_name}.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(sheet_data, f, ensure_ascii=False, indent=2)
        
        print(f"已保存 {output_file}")
        print(f"  - 药品数量: {len(sheet_data['medicines'])}")
        print(f"  - 分类数量: {len(sheet_data['categories'])}")
        
        # 检查示例药品对象
        if sheet_data['medicines']:
            sample = sheet_data['medicines'][0]
            print(f"  - 示例药品: {sample['name']}")
            print(f"  - all_category_codes: {sample['all_category_codes']}")
        print()
    
    print("所有sheet处理完成！")

if __name__ == "__main__":
    main()
