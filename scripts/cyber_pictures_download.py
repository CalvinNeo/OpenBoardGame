import os
import requests
import time

# ================= 配置区域 =================
# 图片保存路径
OUTPUT_PATH = ".cyber_pictures/"

# 🎯 复杂场景与高难度图片源 (Hard Mode)
# 🎯 修复版：稳定且高质量的 Unsplash 图库 (60+ 张)
# 这些都是 Unsplash 历史上最经典的图片 ID，极不易 404
IMAGE_SOURCES = [
    # --- 🦁 动物 (特征鲜明) ---
    "https://images.unsplash.com/photo-1557050543-4d5f430d9e9c?w=800&q=80", # 大象 (Elephant)
    "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80", # 水母 (Jellyfish)
    "https://images.unsplash.com/photo-1552083974-186346191183?w=800&q=80", # 火烈鸟 (Flamingo)
    "https://images.unsplash.com/photo-1535083252457-6080fe29be45?w=800&q=80", # 熊捕鱼 (Bear Fishing)
    "https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=800&q=80", # 黑猫 (Black Cat)
    "https://images.unsplash.com/photo-1505672675380-41225e4c831d?w=800&q=80", # 奔跑的狗 (Running Dog)
    "https://images.unsplash.com/photo-1546182990-dced71b4a789?w=800&q=80", # 狮子 (Lion)
    "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=800&q=80", # 乌龟 (Turtle)

    # --- 🏠 室内与物品 (复杂细节) ---
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80", # 凌乱画室 (Messy Art Studio)
    "https://images.unsplash.com/photo-1556910103-1c02745a30bf?w=800&q=80", # 厨房做饭 (Cooking in Kitchen)
    "https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800&q=80", # 国际象棋 (Chess)
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80", # 黑客桌面 (Hacker Desk)
    "https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=800&q=80", # 温馨客厅 (Cozy Living Room)
    "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=800&q=80", # 糖果罐 (Candy Jars)
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80", # 耳机与音乐 (Headphones)
    "https://images.unsplash.com/photo-1520986606214-8b456906c813?w=800&q=80", # 俯视早餐 (Breakfast Table)

    # --- 🏙️ 建筑与地标 (几何线条) ---
    "https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=800&q=80", # 埃菲尔铁塔 (Eiffel Tower)
    "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800&q=80", # 泰姬陵 (Taj Mahal)
    "https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?w=800&q=80", # 金字塔 (Pyramids)
    "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80", # 金门大桥 (Golden Gate Bridge)
    "https://images.unsplash.com/photo-1518063319789-7217e6706b04?w=800&q=80", # 旋转楼梯 (Spiral Staircase)
    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80", # 城市俯瞰 (Chicago River)
    "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&q=80", # 高楼仰视 (Skyscrapers)
    "https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=800&q=80", # 孤独灯塔 (Lighthouse)

    # --- 🎭 场景与叙事 (氛围感) ---
    "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=800&q=80", # 篝火晚会 (Campfire)
    "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=800&q=80", # 雨窗 (Rainy Window)
    "https://images.unsplash.com/photo-1459749411177-287ce3276916?w=800&q=80", # 演唱会人群 (Concert Crowd)
    "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=800&q=80", # 雨中婚礼 (Wedding in Rain)
    "https://images.unsplash.com/photo-1533552882902-18d42d3806c9?w=800&q=80", # 夜市/灯笼 (Night Market)
    "https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?w=800&q=80", # 女孩吹泡泡 (Blowing Bubbles)
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80", # 女孩背影与森林 (Girl in Forest)

    # --- 🌌 自然与风景 (色彩与光影) ---
    "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800&q=80", # 宇航员/太空 (Astronaut)
    "https://images.unsplash.com/photo-1502680390469-be75c70282c0?w=800&q=80", # 冲浪 (Surfing)
    "https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=800&q=80", # 雪中小屋 (Snow Cabin)
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80", # 热带海滩 (Tropical Beach)
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80", # 云海山峰 (Mountain Clouds)
    "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80", # 孤独的树 (Lone Tree)
    "https://images.unsplash.com/photo-1516214104703-d21b97116c20?w=800&q=80", # 极光 (Aurora)

    # --- 🍕 食物 (高饱和度) ---
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80", # 汉堡 (Burger)
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80", # 披萨 (Pizza)
    "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=800&q=80", # 草莓 (Strawberries)
    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80", # 拉花咖啡 (Latte Art)
    "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=800&q=80", # 冰淇淋 (Ice Cream)
    "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80", # 寿司 (Sushi)
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80", # 烤肉 (BBQ)

    # --- 🚗 交通工具 (形状识别) ---
    "https://images.unsplash.com/photo-1496442226666-8d4a0e62e6e9?w=800&q=80", # 纽约黄色出租 (Yellow Taxi)
    "https://images.unsplash.com/photo-1541443131876-44b03de101c5?w=800&q=80", # 红色跑车 (Red Car)
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80", # 帆船 (Sailboat)
    "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80", # 飞机 (Airplane)
    "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&q=80", # 自行车 (Bicycle)
    "https://images.unsplash.com/photo-1532974297617-c0f05fe48bff?w=800&q=80", # 复古面包车 (Vintage Van)

    # --- 🎨 纹理与静物 (抽象) ---
    "https://images.unsplash.com/photo-1493606278519-11aa9f86e40a?w=800&q=80", # 砖墙 (Brick Wall)
    "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=80", # 咖啡豆 (Coffee Beans)
    "https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=800&q=80", # 涂鸦墙 (Graffiti)
    "https://images.unsplash.com/photo-1535498730771-e735b998cd64?w=800&q=80", # 红色雨伞 (Red Umbrella)
    "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80", # 复古相机 (Vintage Camera)
    "https://images.unsplash.com/photo-1525351484163-7529414395d8?w=800&q=80", # 面包店陈列 (Bakery)
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