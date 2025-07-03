import React, { useEffect, useState, useRef } from 'react';
import { Search, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

interface Medicine {
  id: string;
  name: string;
  sheet: string;
  category_code: string | null;
  category_name: string;
  subcategory_code?: string | null;
  subcategory_name?: string;
  dosage?: string;
  note?: string;
  notes?: string[];
  payment_standard?: string[];
  validity_period?: string;
  all_category_codes?: string[];
}

interface Category {
  code: string;
  name: string;
  level: number;
  parent_code: string | null;
  subcategories: Record<string, Category>;
  medicine_count: number;
}

interface SheetData {
  categories: Record<string, Category>;
  medicines: Medicine[];
}

const SHEET_NAMES = [
  '西药部分',
  '中成药部分',
  '协议西药',
  '协议中成药',
  '竞价药品部分',
];

function App() {
  const [medicineData, setMedicineData] = useState<Record<string, SheetData> | null>(null);
  const [search, setSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedSheet, setSelectedSheet] = useState(SHEET_NAMES[0]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<{[key:string]:boolean}>({});
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        // 加载所有sheet的数据
        const [xiyaoData, zhongchengyaoData, xieyixiyaoData, xieyizhongchengyaoData, jingjiaData] = await Promise.all([
          fetch('/src/西药部分.json').then(res => res.json()),
          fetch('/src/中成药部分.json').then(res => res.json()),
          fetch('/src/协议西药.json').then(res => res.json()),
          fetch('/src/协议中成药.json').then(res => res.json()),
          fetch('/src/竞价药品部分.json').then(res => res.json())
        ]);
        
        setMedicineData({
          '西药部分': xiyaoData,
          '中成药部分': zhongchengyaoData,
          '协议西药': xieyixiyaoData,
          '协议中成药': xieyizhongchengyaoData,
          '竞价药品部分': jingjiaData
        });
      } catch (error) {
        console.error('加载数据失败:', error);
      }
    };
    
    loadData();
  }, []);

  useEffect(() => {
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setExpandedCategories({});
    setPage(1);
  }, [selectedSheet]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory, selectedSubcategory]);

  useEffect(() => {
    if (selectedCategory && categoryRefs.current[selectedCategory]) {
      categoryRefs.current[selectedCategory]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [selectedCategory]);

  if (!medicineData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  const sheetData: SheetData = medicineData[selectedSheet];



  // 递归查找分类
  function findCategory(code: string, categories: Record<string, Category>): Category | null {
    for (const cat of Object.values(categories)) {
      if (cat.code === code) return cat;
      if (cat.subcategories) {
        const found = findCategory(code, cat.subcategories);
        if (found) return found;
      }
    }
    return null;
  }

  // 获取所有下级分类编码（递归）
  function getAllDescendantCodes(code: string, categories: Record<string, Category>): string[] {
    let result = [code];
    const cat = categories[code];
    if (cat && cat.subcategories) {
      for (const subCode in cat.subcategories) {
        result = result.concat(getAllDescendantCodes(subCode, cat.subcategories));
      }
    }
    return result;
  }

  // 过滤药品
  let descendantCodes: string[] = [];
  if (selectedCategory && !selectedSubcategory) {
    descendantCodes = getAllDescendantCodes(selectedCategory, sheetData.categories);
  }
  const filteredMedicines = sheetData.medicines.filter((med) => {
    // 搜索关键词过滤
    if (search && !med.name.includes(search)) return false;
    // 分类过滤
    if (selectedCategory && !selectedSubcategory) {
      // 父级分类：只要药品的all_category_codes包含任一子孙分类编码即可
      const codes = Array.isArray(med.all_category_codes) ? med.all_category_codes.map(c => String(c).trim().toUpperCase()) : [];
      return descendantCodes.some(code => codes.includes(String(code).trim().toUpperCase()));
    }
    if (selectedSubcategory) {
      return String(med.subcategory_code).trim().toUpperCase() === String(selectedSubcategory).trim().toUpperCase();
    }
    return true;
  });
  // 调试输出
  console.log('当前分类:', selectedCategory, '下级编码:', descendantCodes, '过滤后药品数:', filteredMedicines.length, filteredMedicines.slice(0, 5));

  // 分页数据
  const total = filteredMedicines.length;
  const totalPages = Math.ceil(total / pageSize);
  const pagedMedicines = filteredMedicines.slice((page-1)*pageSize, page*pageSize);

  // 递归渲染分类树
  function renderCategoryTree(categories: Record<string, Category>, level = 0) {
    return Object.values(categories).map((cat: Category) => {
      const expanded = expandedCategories[cat.code] ?? false;
      const hasChildren = cat.subcategories && Object.keys(cat.subcategories).length > 0;
      return (
        <div key={cat.code} style={{ marginLeft: level * 12 }}>
          <div
            className={`flex items-center cursor-pointer py-1 px-2 rounded group ${selectedCategory === cat.code ? 'bg-blue-100 text-blue-700' : ''}`}
            onClick={() => {
              setSelectedCategory(cat.code);
              setSelectedSubcategory(null);
              setPage(1);
            }}
          >
            {hasChildren && (
              <span
                className="mr-1 text-xs select-none"
                onClick={e => {
                  e.stopPropagation();
                  setExpandedCategories(prev => ({ ...prev, [cat.code]: !expanded }));
                }}
              >
                {expanded ? '▼' : '▶'}
              </span>
            )}
            <span className="truncate max-w-[160px] group-hover:max-w-none" title={cat.name}>
              {cat.name} ({cat.medicine_count})
            </span>
          </div>
          {hasChildren && expanded && (
            <div>{renderCategoryTree(cat.subcategories, level + 1)}</div>
          )}
        </div>
      );
    });
  }



  // 生成分页按钮
  const generatePaginationItems = () => {
    const items = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              isActive={page === i}
              onClick={() => setPage(i)}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      // 显示第一页
      items.push(
        <PaginationItem key={1}>
          <PaginationLink
            isActive={page === 1}
            onClick={() => setPage(1)}
          >
            1
          </PaginationLink>
        </PaginationItem>
      );

      // 如果当前页距离第一页较远，显示省略号
      if (page > 3) {
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // 显示当前页附近的页面
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      
      for (let i = start; i <= end; i++) {
        if (i > 1 && i < totalPages) {
          items.push(
            <PaginationItem key={i}>
              <PaginationLink
                isActive={page === i}
                onClick={() => setPage(i)}
              >
                {i}
              </PaginationLink>
            </PaginationItem>
          );
        }
      }

      // 如果当前页距离最后一页较远，显示省略号
      if (page < totalPages - 2) {
        items.push(
          <PaginationItem key="ellipsis2">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // 显示最后一页
      if (totalPages > 1) {
        items.push(
          <PaginationItem key={totalPages}>
            <PaginationLink
              isActive={page === totalPages}
              onClick={() => setPage(totalPages)}
            >
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        );
      }
    }
    
    return items;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-2 py-4">
        {/* 头部 */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">药品目录查询系统</h1>
            <div className="flex items-center gap-4">
              <p className="text-gray-500">查询医保药品目录信息(2024)</p>
              {/* 当前选中分类信息 */}
              {selectedCategory && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-md">
                  <span className="text-sm font-medium text-blue-800">当前分类：</span>
                  {(() => {
                    console.log('选中的分类编码:', selectedCategory);
                    const category = findCategory(selectedCategory, sheetData.categories);
                    console.log('找到的分类:', category);
                    if (!category) return <span className="text-red-500">分类未找到: {selectedCategory}</span>;
                    
                    // 构建完整的分类路径
                    const categoryPath = [];
                    let currentCat: Category | null = category;
                    while (currentCat) {
                      categoryPath.unshift({
                        code: currentCat.code,
                        name: currentCat.name,
                        count: currentCat.medicine_count
                      });
                      currentCat = currentCat.parent_code ? findCategory(currentCat.parent_code, sheetData.categories) : null;
                    }
                    
                    return (
                      <div className="flex items-center space-x-1">
                        {categoryPath.map((cat, index) => (
                          <React.Fragment key={cat.code}>
                            <span className="text-sm text-blue-600 font-medium">
                              {cat.name} ({cat.count})
                            </span>
                            {index < categoryPath.length - 1 && (
                              <span className="text-gray-400">→</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
          {/* 移动端分类按钮 */}
          <button
            className="sm:hidden flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white shadow hover:bg-blue-700"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="h-5 w-5" /> 分类
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* 左侧tab+分类树整体，PC显示，移动端抽屉 */}
          <div className="hidden lg:block lg:col-span-1 mb-4 lg:mb-0">
            <Card className="rounded-xl shadow-md overflow-hidden">
              <div className="flex min-h-0 h-[600px] items-stretch">
                <Tabs value={selectedSheet} onValueChange={setSelectedSheet} className="w-14 flex-shrink-0 min-h-0 h-full">
                  <TabsList className="flex flex-col w-14 h-full min-h-0 border-r border-gray-200 !p-0">
                    {SHEET_NAMES.map((name) => (
                      <TabsTrigger
                        key={name}
                        value={name}
                        className="w-full h-24 flex flex-col items-center justify-center [writing-mode:vertical-rl] text-center text-sm font-semibold border-0 rounded-none transition-all !p-0 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-700 hover:bg-blue-50 focus:outline-none"
                      >
                        {name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <div className="flex-1 flex flex-col min-h-0 w-0 h-full">
                  {/* PC端分类搜索 */}
                  <div className="p-2 border-b border-gray-200">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="搜索分类..."
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        className="pl-8 h-8 text-xs border-gray-300 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-1 w-full">
                    {renderCategoryTree(sheetData.categories)}
                  </div>
                </div>
              </div>
            </Card>
          </div>
          {/* 移动端抽屉 */}
          {drawerOpen && (
            <div className="fixed inset-0 z-50 bg-black/40 flex">
              <div className="w-72 max-w-[80vw] bg-white h-full shadow-lg p-0 flex flex-col">
                <div className="flex items-center justify-between mb-4 p-4">
                  <span className="font-bold text-lg">分类</span>
                  <button onClick={() => setDrawerOpen(false)} className="text-gray-500 hover:text-blue-600 text-xl">×</button>
                </div>
                <div className="flex flex-1 min-h-0">
                  <Tabs value={selectedSheet} onValueChange={setSelectedSheet} className="w-12 flex-shrink-0">
                    <TabsList className="flex flex-col w-12 h-full min-h-0 border-r border-gray-200 !p-0">
                      {SHEET_NAMES.map((name) => (
                        <TabsTrigger
                          key={name}
                          value={name}
                          className="w-full h-20 flex flex-col items-center justify-center [writing-mode:vertical-rl] text-center text-xs font-semibold border-0 rounded-none transition-all !p-0 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-700 hover:bg-blue-50 focus:outline-none"
                        >
                          {name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                  <div className="flex-1 p-2 flex flex-col min-h-0">
                    {/* 移动端分类搜索 */}
                    <div className="mb-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="搜索分类..."
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          className="pl-8 h-8 text-xs border-gray-300 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    {/* 分类树内容 */}
                    <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-1">
                      {renderCategoryTree(sheetData.categories)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1" onClick={() => setDrawerOpen(false)} />
            </div>
          )}
          {/* 右侧药品列表 */}
          <div className="lg:col-span-3">
            <Card className="rounded-xl shadow-md">
              {/* 搜索栏PC右上角，手机独占一行 */}
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-0">
                <div>
                  <CardTitle className="text-lg">药品列表</CardTitle>
                  <span className="text-sm text-gray-500 block mt-1">
                    共 {filteredMedicines.length} 条记录
                  </span>
                </div>
                <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mt-2 sm:mt-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      placeholder="输入药品名称关键词..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-11 h-10 rounded-md shadow-sm border-gray-300 focus:ring-2 focus:ring-blue-500 w-full"
                    />
                  </div>
                  <Button 
                    variant="default" 
                    className="h-10 px-4 rounded-md shadow-sm bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                    onClick={() => {
                      setSearch('');
                      setCategorySearch('');
                      setSelectedCategory(null);
                      setSelectedSubcategory(null);
                      setExpandedCategories({});
                      setPage(1);
                    }}
                  >
                    重置
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* 药品表格 */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] divide-y divide-gray-200">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700">
                        <th className="text-left p-3 font-semibold">名称</th>
                        <th className="text-left p-3 font-semibold">分类</th>
                        <th className="text-left p-3 font-semibold">剂型/医保支付标准</th>
                        <th className="text-left p-3 font-semibold">备注</th>
                        <th className="text-left p-3 font-semibold">搜索</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedMedicines.map((med, idx) => (
                        <tr key={med.id} className={cn("hover:bg-blue-50 transition-colors", idx % 2 === 1 ? "bg-white" : "bg-gray-50") }>
                          <td className="p-3 font-medium break-words whitespace-pre-line" title={med.name}>{med.name || '—'}</td>
                          <td className="p-3 text-sm text-gray-500 break-words whitespace-pre-line" title={med.subcategory_name || med.category_name || '—'}>
                            {med.subcategory_name || med.category_name || '—'}
                          </td>
                          <td className="p-3 text-sm break-words whitespace-pre-line" title={med.dosage || (med.payment_standard && med.payment_standard.join(' / ')) || '—'}>
                            {med.dosage || (med.payment_standard && med.payment_standard.join(' / ')) || '—'}
                          </td>
                          <td className="p-3 text-sm break-words whitespace-pre-line">
                            <div className="space-y-1">
                              {med.note || (med.notes && med.notes.join(' / ')) || '—'}
                              {med.validity_period && (
                                <div className="text-xs text-gray-500">
                                  协议有效期：{med.validity_period}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-sm whitespace-nowrap">
                            <a
                              href={`https://www.baidu.com/s?wd=${encodeURIComponent(med.name)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline mr-2"
                            >百度</a>
                            <a
                              href={`https://www.google.com/search?q=${encodeURIComponent(med.name)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-600 hover:underline"
                            >Google</a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 分页 */}
                {totalPages > 1 && (
                  <div className="mt-6">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setPage(Math.max(1, page - 1))}
                            className={cn(page === 1 && "pointer-events-none opacity-50")}
                          />
                        </PaginationItem>
                        
                        {generatePaginationItems()}
                        
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setPage(Math.min(totalPages, page + 1))}
                            className={cn(page === totalPages && "pointer-events-none opacity-50")}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
