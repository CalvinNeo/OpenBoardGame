import os
import requests
import time

# ================= 配置区域 =================
# 图片保存路径
OUTPUT_PATH = ".cyber_pictures/"

# 🎯 复杂场景与高难度图片源 (Hard Mode)
# 🎯 修复版：稳定且高质量的 Unsplash 图库 (60+ 张)
# 这些都是 Unsplash 历史上最经典的图片 ID，极不易 404
# 🎯 终极稳定版：Unsplash "名人堂" 经典图库 (80+ 张)
# 选取了下载量最高、最稳定的经典图片，极大降低 404 概率
IMAGE_SOURCES = [
    # ==========================================
    # 🦁 1. 动物王国 (Animals) - 20张
    # ==========================================
    "https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=800&q=80", # 狐狸 (Fox)
    "https://images.unsplash.com/photo-1546182990-dced71b4a789?w=800&q=80", # 雄狮 (Lion)
    "https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=800&q=80", # 斑马 (Zebra)
    "https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=800&q=80", # 黑猫 (Black Cat)
    "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=800&q=80", # 斗牛犬 (Pug)
    "https://images.unsplash.com/photo-1552083974-186346191183?w=800&q=80", # 火烈鸟 (Flamingo)
    "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=800&q=80", # 海龟 (Turtle)
    "https://images.unsplash.com/photo-1557050543-4d5f430d9e9c?w=800&q=80", # 象群 (Elephants)
    "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=800&q=80", # 戴墨镜的猫 (Cool Cat)
    "https://images.unsplash.com/photo-1505672675380-41225e4c831d?w=800&q=80", # 奔跑的狗 (Running Dog)
    "https://images.unsplash.com/photo-1456926631375-92c8ce872def?w=800&q=80", # 豹子 (Leopard)
    "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=800&q=80", # 树懒 (Sloth)
    "https://images.unsplash.com/photo-1589656966895-2f33e7653819?w=800&q=80", # 北极熊 (Polar Bear)
    "https://images.unsplash.com/photo-1501706362039-c06b2d715385?w=800&q=80", # 变色龙 (Chameleon)
    "https://images.unsplash.com/photo-1535083252457-6080fe29be45?w=800&q=80", # 熊捕鱼 (Bear Fishing)
    "https://images.unsplash.com/photo-1555169062-013468b47731?w=800&q=80", # 鹦鹉 (Parrot)
    "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80", # 奔跑的马 (Horse)
    "https://images.unsplash.com/photo-1452857297128-d9c29adba80b?w=800&q=80", # 兔子 (Rabbit)
    "https://images.unsplash.com/photo-1504006833117-8886a36a6875?w=800&q=80", # 熊猫 (Panda)
    "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80", # 水母 (Jellyfish)

    # ==========================================
    # 🍕 2. 美食盛宴 (Food & Drink) - 20张
    # ==========================================
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80", # 披萨 (Pizza)
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80", # 汉堡 (Burger)
    "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800&q=80", # 煎蛋吐司 (Eggs)
    "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800&q=80", # 蓝莓煎饼 (Pancakes)
    "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80", # 冰淇淋 (Ice Cream)
    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80", # 拉花咖啡 (Latte)
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80", # 烤肉串 (BBQ)
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80", # 沙拉 (Salad)
    "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=800&q=80", # 寿司 (Sushi)
    "https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=800&q=80", # 橙汁 (Juice)
    "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&q=80", # 鸡尾酒 (Cocktail)
    "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80", # 牛排 (Steak)
    "https://images.unsplash.com/photo-1606851682862-2769d30c52eb?w=800&q=80", # 甜甜圈 (Donuts)
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80", # 亚洲面条 (Noodles)
    "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=800&q=80", # 草莓 (Strawberries)
    "https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80", # 啤酒 (Beer)
    "https://images.unsplash.com/photo-1559656914-a34ad8331306?w=800&q=80", # 爆米花 (Popcorn)
    "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&q=80", # 马卡龙 (Macarons)
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80", # 蔬菜拼盘 (Veggie)
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80", # 烤鸡 (Roast Chicken)

    # ==========================================
    # 🏙️ 3. 建筑地标 (Architecture) - 18张
    # ==========================================
    "https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=800&q=80", # 埃菲尔铁塔
    "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800&q=80", # 泰姬陵
    "https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?w=800&q=80", # 金字塔
    "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80", # 大本钟
    "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80", # 金门大桥
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80", # 泳池度假村
    "https://images.unsplash.com/photo-1518063319789-7217e6706b04?w=800&q=80", # 旋转楼梯
    "https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=800&q=80", # 灯塔
    "https://images.unsplash.com/photo-1496442226666-8d4a0e62e6e9?w=800&q=80", # 时代广场
    "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=800&q=80", # 威尼斯贡多拉
    "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80", # 罗马斗兽场
    "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&q=80", # 印度泰姬陵
    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80", # 城市天际线
    "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&q=80", # 摩天大楼仰视
    "https://images.unsplash.com/photo-1512453979798-5ea90b7cadc9?w=800&q=80", # 圣托里尼蓝顶
    "https://images.unsplash.com/photo-1499916078039-92237843f636?w=800&q=80", # 咖啡馆门面
    "https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?w=800&q=80", # 工业风管道
    "https://images.unsplash.com/photo-1519817650394-88f9f4447660?w=800&q=80", # 鸟居

    # ==========================================
    # 🚀 4. 物品与静物 (Objects) - 18张
    # ==========================================
    "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80", # 复古相机
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80", # 耳机
    "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=800&q=80", # 糖果罐
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80", # 红色鞋子
    "https://images.unsplash.com/photo-1527711495246-888998f8287d?w=800&q=80", # 骷髅头
    "https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=800&q=80", # 怀表
    "https://images.unsplash.com/photo-1598198414976-ddb788ec80c1?w=800&q=80", # 游戏手柄
    "https://images.unsplash.com/photo-1555212697-194d092e3b8f?w=800&q=80", # 汽车仪表盘
    "https://images.unsplash.com/photo-1599508704512-2f19efd1e35f?w=800&q=80", # 乐高积木
    "https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800&q=80", # 国际象棋
    "https://images.unsplash.com/photo-1589254065878-42c9da997008?w=800&q=80", # 机器人
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80", # 泰迪熊
    "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80", # 西装领带
    "https://images.unsplash.com/photo-1585338447937-7082f8fc763d?w=800&q=80", # 眼镜
    "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=800&q=80", # 代码屏幕
    "https://images.unsplash.com/photo-1516961642265-531546e84af2?w=800&q=80", # 望远镜
    "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=800&q=80", # 电钻工具
    "https://images.unsplash.com/photo-1504198458649-3128b932f49e?w=800&q=80", # 地球仪

    # ==========================================
    # 🎭 5. 场景与叙事 (Stories) - 15张
    # ==========================================
    "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800&q=80", # 宇航员
    "https://images.unsplash.com/photo-1502680390469-be75c70282c0?w=800&q=80", # 冲浪
    "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=800&q=80", # 雨中婚礼
    "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=800&q=80", # 篝火
    "https://images.unsplash.com/photo-1459749411177-287ce3276916?w=800&q=80", # 演唱会
    "https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?w=800&q=80", # 吹泡泡
    "https://images.unsplash.com/photo-1533552882902-18d42d3806c9?w=800&q=80", # 夜市灯笼
    "https://images.unsplash.com/photo-1530103862676-de3c9a59af57?w=800&q=80", # 派对彩带
    "https://images.unsplash.com/photo-1516387938699-a93567ec168e?w=800&q=80", # 朋友聚餐
    "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80", # 瑜伽课
    "https://images.unsplash.com/photo-1515549832467-8783363e19b6?w=800&q=80", # 咖啡与书
    "https://images.unsplash.com/photo-1556910103-1c02745a30bf?w=800&q=80", # 厨房做饭
    "https://images.unsplash.com/photo-1541443131876-44b03de101c5?w=800&q=80", # 红色跑车
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80", # 帆船
    "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80", # 飞机

    # ==========================================
    # 🎨 6. 自然与纹理 (Nature & Texture) - 15张
    # ==========================================
    "https://images.unsplash.com/photo-1493606278519-11aa9f86e40a?w=800&q=80", # 砖墙
    "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=80", # 咖啡豆
    "https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=800&q=80", # 涂鸦
    "https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=800&q=80", # 雪中小屋
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80", # 海滩
    "https://images.unsplash.com/photo-1516214104703-d21b97116c20?w=800&q=80", # 极光
    "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80", # 孤独的树
    "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80", # 水果堆
    "https://images.unsplash.com/photo-1515434126000-961d90c046bf?w=800&q=80", # 冰川
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80", # 森林女孩
    "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=800&q=80", # 玫瑰花瓣
    "https://images.unsplash.com/photo-1535498730771-e735b998cd64?w=800&q=80", # 红伞
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80", # 云海山峰
    "https://images.unsplash.com/photo-1531685250784-756994db931e?w=800&q=80", # 彩色粉末(Holi)
    "https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?w=800&q=80", # 薰衣草田
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