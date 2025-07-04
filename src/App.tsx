import React, { useEffect, useState, useRef } from 'react';
import { Search, Menu, Sun, Moon } from 'lucide-react';
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
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 主题初始化
  useEffect(() => {
    // 检查本地存储的主题
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      // 检查浏览器默认主题
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const defaultTheme = prefersDark ? 'dark' : 'light';
      setTheme(defaultTheme);
      document.documentElement.classList.toggle('dark', defaultTheme === 'dark');
    }
  }, []);

  // 主题切换函数
  const toggleTheme = () => {
    console.log('切换主题，当前主题:', theme);
    const newTheme = theme === 'light' ? 'dark' : 'light';
    console.log('新主题:', newTheme);
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    console.log('HTML classList:', document.documentElement.classList.toString());
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        // 加载所有sheet的数据
        const [xiyaoData, zhongchengyaoData, xieyixiyaoData, xieyizhongchengyaoData, jingjiaData] = await Promise.all([
          fetch('./src/西药部分.json').then(res => res.json()),
          fetch('./src/中成药部分.json').then(res => res.json()),
          fetch('./src/协议西药.json').then(res => res.json()),
          fetch('./src/协议中成药.json').then(res => res.json()),
          fetch('./src/竞价药品部分.json').then(res => res.json())
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">加载中...</p>
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
      // 检查药品是否属于选中的分类或其子分类
      const codes = Array.isArray(med.all_category_codes) ? med.all_category_codes.map(c => String(c).trim().toUpperCase()) : [];
      const medCategoryCode = med.category_code ? String(med.category_code).trim().toUpperCase() : '';
      
      // 如果药品的分类编码直接匹配选中的分类，或者包含在子孙分类中
      return medCategoryCode === String(selectedCategory).trim().toUpperCase() || 
             descendantCodes.some(code => codes.includes(String(code).trim().toUpperCase()));
    }
    if (selectedSubcategory) {
      return String(med.subcategory_code).trim().toUpperCase() === String(selectedSubcategory).trim().toUpperCase();
    }
    return true;
  });
  // 调试输出
  console.log('当前分类:', selectedCategory, '下级编码:', descendantCodes, '过滤后药品数:', filteredMedicines.length, filteredMedicines.slice(0, 5));
  
  // 如果分类搜索有内容，显示搜索结果统计
  const searchResultCount = categorySearch ? searchCategories(sheetData.categories, categorySearch).length : 0;

  // 分页数据
  const total = filteredMedicines.length;
  const totalPages = Math.ceil(total / pageSize);
  const pagedMedicines = filteredMedicines.slice((page-1)*pageSize, page*pageSize);

  // 递归搜索分类
  function searchCategories(categories: Record<string, Category>, searchTerm: string): Category[] {
    const results: Category[] = [];
    
    Object.values(categories).forEach((cat) => {
      // 检查当前分类是否匹配
      if (cat.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        results.push(cat);
      }
      
      // 递归搜索子分类
      if (cat.subcategories && Object.keys(cat.subcategories).length > 0) {
        results.push(...searchCategories(cat.subcategories, searchTerm));
      }
    });
    
    return results;
  }

  // 递归渲染分类树
  function renderCategoryTree(categories: Record<string, Category>, level = 0, isMobileDrawer = false) {
    // 过滤分类
    let filteredCategories: Category[];
    if (categorySearch) {
      // 如果有搜索词，递归搜索所有层级
      filteredCategories = searchCategories(categories, categorySearch);
    } else {
      // 没有搜索词时，显示当前层级的分类
      filteredCategories = Object.values(categories);
    }

    return filteredCategories.map((cat: Category) => {
      const expanded = expandedCategories[cat.code] ?? false;
      const hasChildren = cat.subcategories && Object.keys(cat.subcategories).length > 0;
      const isSelected = selectedCategory === cat.code;
      
      return (
        <div key={cat.code} style={{ marginLeft: level * 12 }}>
          <div
            className={`flex items-center cursor-pointer py-1 px-2 rounded group ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            style={{ WebkitOverflowScrolling: 'touch' }}
            onClick={() => {
              setSelectedCategory(cat.code);
              setSelectedSubcategory(null);
              setPage(1);
              if (isMobileDrawer) setDrawerOpen(false); // 移动端点击关闭菜单
            }}
          >
            {hasChildren && (
              <span
                className="mr-1 text-xs select-none text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                onClick={e => {
                  e.stopPropagation();
                  setExpandedCategories(prev => ({ ...prev, [cat.code]: !expanded }));
                }}
              >
                {expanded ? '▼' : '▶'}
              </span>
            )}
            <span className="inline-block text-gray-900 dark:text-gray-100 truncate max-w-full" title={cat.name}>
              {cat.name} ({cat.medicine_count})
            </span>
          </div>
          {hasChildren && expanded && (
            <div>{renderCategoryTree(cat.subcategories, level + 1, isMobileDrawer)}</div>
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-2 py-4">
        {/* 头部 */}
        <div className="mb-3 flex items-center justify-between sm:gap-0 gap-2">
          <div className="flex-1 min-w-0">
            {/* 移动端只显示缩小主标题 */}
            <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-1 tracking-tight truncate sm:hidden">药品目录查询系统</h1>
            {/* PC端显示大标题和副标题、当前分类 */}
            <div className="hidden sm:block">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">药品目录查询系统</h1>
              <div className="flex items-center gap-4 mb-1">
                <div className="text-gray-500 dark:text-gray-400 text-base">查询医保药品目录信息(2024)</div>
                {selectedCategory && (
                  <div className="text-sm px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded inline-block max-w-full overflow-hidden">
                    <span className="font-medium">当前分类：</span>
                    {(() => {
                      const category = findCategory(selectedCategory, sheetData.categories);
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
                        <span className="inline-flex flex-wrap items-center gap-1 max-w-full">
                          {categoryPath.map((cat, index) => (
                            <React.Fragment key={cat.code}>
                              <span className="font-medium truncate">{cat.name}({cat.count})</span>
                              {index < categoryPath.length - 1 && (
                                <span className="text-blue-300 dark:text-blue-400 flex-shrink-0">→</span>
                              )}
                            </React.Fragment>
                          ))}
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* 右侧按钮组 */}
          <div className="flex items-center gap-2">
            {/* 主题切换按钮 */}
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              title={theme === 'light' ? '切换到黑暗模式' : '切换到明亮模式'}
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>

            {/* 移动端分类按钮 */}
            <button
              className="sm:hidden flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 dark:bg-blue-700 text-white shadow hover:bg-blue-700 dark:hover:bg-blue-800"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="h-5 w-5" /> 分类
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* 左侧tab+分类树整体，PC显示，移动端抽屉 */}
          <div className="hidden lg:block lg:col-span-1 mb-4 lg:mb-0">
            <Card className="rounded-xl shadow-md overflow-hidden bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="flex min-h-0 h-[600px] items-stretch">
                <Tabs value={selectedSheet} onValueChange={setSelectedSheet} className="w-14 flex-shrink-0 min-h-0 h-full">
                  <TabsList className="flex flex-col w-14 h-full min-h-0 border-r border-gray-200 dark:border-gray-700 !p-0 bg-gray-100 dark:bg-gray-700">
                    {SHEET_NAMES.map((name) => (
                      <TabsTrigger
                        key={name}
                        value={name}
                        className="w-full h-[120px] flex flex-col items-center justify-center [writing-mode:vertical-rl] text-center text-sm font-semibold border-0 rounded-none transition-all !p-0 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:bg-transparent dark:data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-700 dark:data-[state=inactive]:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:outline-none"
                      >
                        {name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <div className="flex-1 flex flex-col min-h-0 min-w-0">
                  {/* PC端分类搜索 */}
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700 min-w-0">
                    <div className="relative min-w-0">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="搜索分类..."
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        className="pl-8 h-8 text-xs border-gray-300 dark:border-gray-600 focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 min-w-0"
                      />
                    </div>
                    {categorySearch && (
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        找到 {searchResultCount} 个分类
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-1 w-full min-w-0">
                    <div className="w-full flex flex-col">
                      {renderCategoryTree(sheetData.categories, 0, false)}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
          {/* 移动端抽屉 */}
          {drawerOpen && (
            <div className="fixed inset-0 z-50 bg-black/40 flex">
              <div className="w-72 max-w-[80vw] bg-white dark:bg-gray-800 h-full shadow-lg p-0 flex flex-col">
                <div className="flex items-center justify-between mb-4 p-4">
                  <span className="font-bold text-lg text-gray-900 dark:text-white">分类</span>
                  <button onClick={() => setDrawerOpen(false)} className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-xl">×</button>
                </div>
                <div className="flex flex-1 min-h-0">
                  <Tabs value={selectedSheet} onValueChange={setSelectedSheet} className="w-14 flex-shrink-0">
                    <TabsList className="flex flex-col w-14 h-full min-h-0 border-r border-gray-200 dark:border-gray-700 !p-0 bg-gray-100 dark:bg-gray-700">
                      {SHEET_NAMES.map((name) => (
                        <TabsTrigger
                          key={name}
                          value={name}
                          className="w-full flex-1 flex flex-col items-center justify-center [writing-mode:vertical-rl] text-center text-sm font-semibold border-0 rounded-none transition-all !p-0 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:bg-transparent dark:data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-700 dark:data-[state=inactive]:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:outline-none"
                        >
                          {name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                  <div className="flex-1 p-2 flex flex-col min-h-0 min-w-0">
                    {/* 移动端分类搜索 */}
                    <div className="mb-2 min-w-0">
                      <div className="relative min-w-0">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="搜索分类..."
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          className="pl-8 h-8 text-xs border-gray-300 dark:border-gray-600 focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 min-w-0"
                        />
                      </div>
                      {categorySearch && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          找到 {searchResultCount} 个分类
                        </div>
                      )}
                    </div>
                    {/* 分类树内容 */}
                    <div className="flex-1 min-h-0 overflow-y-auto pr-2 min-w-0">
                      <div className="w-full flex flex-col">
                        {renderCategoryTree(sheetData.categories, 0, true)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1" onClick={() => setDrawerOpen(false)} />
            </div>
          )}

          {/* 数据来源和免责声明弹窗 */}
          {disclaimerOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">数据来源与免责声明</h2>
                    <button
                      onClick={() => setDisclaimerOpen(false)}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl font-bold"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    {/* 数据来源 */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">数据来源</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        本系统数据来源于国家医疗保障局官方网站发布的《国家基本医疗保险、工伤保险和生育保险药品目录（2024年）》。
                        数据包括西药部分、中成药部分、协议西药、协议中成药、竞价药品部分等完整目录信息。
                      </p>
                    </div>

                    {/* 分隔线 */}
                    <div className="border-t border-gray-200 dark:border-gray-700"></div>

                    {/* 免责声明 */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">免责声明</h3>
                      <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed space-y-3">
                        <p>
                          <span className="font-medium">1.</span> 本系统仅提供药品目录查询服务，数据仅供参考，具体报销政策请以当地医保部门规定为准。
                        </p>
                        <p>
                          <span className="font-medium">2.</span> 药品信息可能存在更新延迟，建议在使用前与医疗机构或医保部门核实最新信息。
                        </p>
                        <p>
                          <span className="font-medium">3.</span> 本系统不承担因使用本系统信息而产生的任何医疗、法律或经济责任。
                        </p>
                        <p>
                          <span className="font-medium">4.</span> 如发现数据错误或需要更新，请联系相关医保部门进行核实和更正。
                        </p>
                      </div>
                    </div>

                    {/* 官方链接 */}
                    <div className="text-center pt-4">
                      <a
                        href="http://www.nhsa.gov.cn/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                        </svg>
                        访问国家医疗保障局官网
                      </a>
                    </div>
                  </div>

                  {/* 关闭按钮 */}
                  <div className="mt-6 text-center">
                    <button
                      onClick={() => setDisclaimerOpen(false)}
                      className="px-6 py-2 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white rounded-lg transition-colors"
                    >
                      我知道了
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 右侧药品列表 */}
          <div className="lg:col-span-3">
            <Card className="rounded-xl shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              {/* 搜索栏PC右上角，手机独占一行 */}
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-0">
                <div>
                  <CardTitle className="text-lg text-gray-900 dark:text-white">药品列表</CardTitle>
                  <span className="text-sm text-gray-500 dark:text-gray-400 block mt-1">
                    共 {filteredMedicines.length} 条记录
                  </span>
                </div>
                <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mt-2 sm:mt-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="输入药品名称关键词..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 h-9 sm:h-10 rounded-full sm:rounded-md text-sm sm:text-base border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <Button 
                    variant="default" 
                    className="h-9 sm:h-10 px-4 rounded-full sm:rounded-md shadow-sm bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white w-full sm:w-auto text-sm sm:text-base"
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
                {/* 药品表格/卡片化 */}
                <div className="overflow-x-auto">
                  {/* 移动端卡片化，PC端表格 */}
                  <div className="sm:hidden flex flex-col gap-3">
                    {pagedMedicines.map((med) => (
                      <div key={med.id} className="bg-white dark:bg-gray-800/60 rounded-xl p-3 shadow flex flex-col gap-1 border border-gray-200 dark:border-gray-700">
                        <div className="font-bold text-base text-gray-900 dark:text-white mb-1">{med.name || '—'}</div>
                        <div className="text-xs text-blue-600 dark:text-blue-300 mb-0.5">{med.subcategory_name || med.category_name || '—'}</div>
                        <div className="text-xs text-gray-700 dark:text-gray-300 mb-0.5">{med.dosage || (med.payment_standard && med.payment_standard.join(' / ')) || '—'}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">{med.note || (med.notes && med.notes.join(' / ')) || '—'}</div>
                        {med.validity_period && (
                          <div className="text-xs text-gray-500 dark:text-gray-500">协议有效期：{med.validity_period}</div>
                        )}
                        <div className="flex gap-2 mt-1">
                          <a
                            href={`https://www.baidu.com/s?wd=${encodeURIComponent(med.name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                          >百度</a>
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(med.name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 dark:text-green-400 hover:underline text-xs"
                          >Google</a>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* PC端表格 */}
                  <table className="hidden sm:table w-full min-w-[600px] divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        <th className="text-left p-3 font-semibold">名称</th>
                        <th className="text-left p-3 font-semibold">分类</th>
                        <th className="text-left p-3 font-semibold">剂型/医保支付标准</th>
                        <th className="text-left p-3 font-semibold">备注</th>
                        <th className="text-left p-3 font-semibold">搜索</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedMedicines.map((med, idx) => (
                        <tr key={med.id} className={cn("hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors", idx % 2 === 1 ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-700/50") }>
                          <td className="p-3 font-medium break-words whitespace-pre-line text-gray-900 dark:text-gray-100" title={med.name}>{med.name || '—'}</td>
                          <td className="p-3 text-sm text-gray-500 dark:text-gray-400 break-words whitespace-pre-line" title={med.subcategory_name || med.category_name || '—'}>
                            {med.subcategory_name || med.category_name || '—'}
                          </td>
                          <td className="p-3 text-sm break-words whitespace-pre-line text-gray-900 dark:text-gray-100" title={med.dosage || (med.payment_standard && med.payment_standard.join(' / ')) || '—'}>
                            {med.dosage || (med.payment_standard && med.payment_standard.join(' / ')) || '—'}
                          </td>
                          <td className="p-3 text-sm break-words whitespace-pre-line text-gray-900 dark:text-gray-100">
                            <div className="space-y-1">
                              {med.note || (med.notes && med.notes.join(' / ')) || '—'}
                              {med.validity_period && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
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
                              className="text-blue-600 dark:text-blue-400 hover:underline mr-2"
                            >百度</a>
                            <a
                              href={`https://www.google.com/search?q=${encodeURIComponent(med.name)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-600 dark:text-green-400 hover:underline"
                            >Google</a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 分页 */}
                {totalPages > 1 && (
                  <div className="mt-6 overflow-x-auto">
                    <div className="flex justify-center min-w-0">
                      <Pagination>
                        <PaginationContent className="flex-nowrap gap-1 sm:gap-2 min-w-0">
                          <PaginationItem>
                            <PaginationPrevious 
                              onClick={() => setPage(Math.max(1, page - 1))}
                              className={cn("sm:px-3 px-4 sm:py-2 py-3 text-base sm:text-sm", page === 1 && "pointer-events-none opacity-50")}
                            />
                          </PaginationItem>
                          {generatePaginationItems()}
                          <PaginationItem>
                            <PaginationNext 
                              onClick={() => setPage(Math.min(totalPages, page + 1))}
                              className={cn("sm:px-3 px-4 sm:py-2 py-3 text-base sm:text-sm", page === totalPages && "pointer-events-none opacity-50")}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* 访问统计、GitHub链接和数据来源按钮 */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-full">
            <span id="busuanzi_container_site_pv">
              本站总访问量 <span id="busuanzi_value_site_pv" className="font-semibold text-blue-600 dark:text-blue-400">-</span> 次
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <a
              href="https://github.com/badman200/medicine"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              GitHub
            </a>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button
              onClick={() => setDisclaimerOpen(true)}
              className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              数据来源与免责声明
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
