import os
import requests
import time

# ================= 配置区域 =================
# 图片保存路径
OUTPUT_PATH = ".cyber_pictures/"

# 🎯 复杂场景与高难度图片源 (Hard Mode)
IMAGE_SOURCES = [
    # --- 🏠 室内与细节 ---
    "https://images.unsplash.com/photo-1556910103-1c02745a30bf?w=800&q=80",
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80",
    "https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=800&q=80",
    "https://images.unsplash.com/photo-1526772662000-3f88f107d6d3?w=800&q=80",
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80",
    "https://images.unsplash.com/photo-1521783988139-89397d761dce?w=800&q=80",
    "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&q=80",

    # --- 🏙️ 城市与人群 ---
    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80",
    "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800&q=80",
    "https://images.unsplash.com/photo-1533552882902-18d42d3806c9?w=800&q=80",
    "https://images.unsplash.com/photo-1496442226666-8d4a0e62e6e9?w=800&q=80",
    "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80",

    # --- 🛠️ 工业与线条 ---
    "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800&q=80",
    "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&q=80",
    "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=800&q=80",
    "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&q=80",
    "https://images.unsplash.com/photo-1532444149090-d539d0df5245?w=800&q=80",

    # --- 🎭 叙事与瞬间 ---
    "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=800&q=80",
    "https://images.unsplash.com/photo-1595840578601-574f17918f40?w=800&q=80",
    "https://images.unsplash.com/photo-1516387938699-a93567ec168e?w=800&q=80",
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80",
    "https://images.unsplash.com/photo-1523726491078-2215091726d1?w=800&q=80",
    "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80",

    # --- 🎨 纹理与静物 ---
    "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80",
    "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=800&q=80",
    "https://images.unsplash.com/photo-1493219686098-93666b72a2db?w=800&q=80",
    "https://images.unsplash.com/photo-1525351484163-7529414395d8?w=800&q=80",

    # --- 🌍 特征风景 ---
    "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80",
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80",
    "https://images.unsplash.com/photo-1480796927426-f609979314bd?w=800&q=80",
    "https://images.unsplash.com/photo-1519810755548-39cd217da494?w=800&q=80",
    "https://images.unsplash.com/photo-1508672019048-805c2763d46d?w=800&q=80",
    
    # --- 🦁 动物动态 ---
    "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80",
    "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&q=80",
    "https://images.unsplash.com/photo-1535083252457-6080fe29be45?w=800&q=80",
]

# ================= 核心逻辑 =================

def extract_filename_from_url(url):
    """
    从 URL 中提取 ID 作为文件名。
    例如: https://images.unsplash.com/photo-123-abc?w=800 
    提取为: photo-123-abc.jpg
    """
    # 1. 去掉问号后面的参数 (?w=800...)
    base_url = url.split('?')[0]
    # 2. 获取最后一个斜杠后面的内容
    name = base_url.split('/')[-1]
    # 3. 加上后缀
    return f"{name}.jpg"

def download_images(urls, output_folder):
    # 创建文件夹
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
        print(f"📁 已创建文件夹: {output_folder}")
    
    print(f"🚀 开始检查 {len(urls)} 张图片...")
    print("-" * 40)

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }

    new_downloads = 0
    skipped = 0

    for index, url in enumerate(urls):
        try:
            filename = extract_filename_from_url(url)
            save_path = os.path.join(output_folder, filename)
            
            # 🔥 关键修改：检查文件是否存在
            if os.path.exists(save_path):
                print(f"⏭️  [已存在] 跳过: {filename}")
                skipped += 1
                continue
            
            # 开始下载
            print(f"⬇️  正在下载 ({index+1}/{len(urls)}): {filename} ...")
            response = requests.get(url, headers=headers, timeout=15)
            
            if response.status_code == 200:
                with open(save_path, 'wb') as f:
                    f.write(response.content)
                new_downloads += 1
                time.sleep(0.5) # 礼貌延时
            else:
                print(f"❌ 下载失败 [Status {response.status_code}]: {url}")
        
        except Exception as e:
            print(f"❌ 发生错误: {e}")

    print("-" * 40)
    print(f"✅ 处理完毕！")
    print(f"   - 新下载: {new_downloads}")
    print(f"   - 已跳过: {skipped}")
    print(f"📁 保存路径: {os.path.abspath(output_folder)}")

# ================= 主程序 =================
if __name__ == "__main__":
    download_images(IMAGE_SOURCES, OUTPUT_PATH)