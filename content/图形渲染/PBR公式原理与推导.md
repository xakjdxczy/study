# PBR 公式原理与推导

**受众**：引擎 / 实时图形学习者  
**网页**：`图形渲染/PBR/index.html`  
**锚点约定**：课内 `#why-pbr` `#render-eq` `#microfacet` `#cook-torrance` `#d-ggx` `#f-fresnel` `#g-smith` `#diffuse-metallic` `#realtime` `#summary` `#quiz`

---

## 1. 为什么要 PBR `#why-pbr`

**结论**：PBR 把「材质常数」与「光照条件」拆开——同一套金属度/粗糙度在不同灯光下仍看起来像同一种物质；Phong 往往要对着某一盏灯拧高光指数与颜色。

| | Phong 系 | PBR（微表面） |
|--|--|--|
| 参数含义 | 多为外观旋钮 | 尽量对应物理量（粗糙度、F0、金属度） |
| 换光 | 常要重调 | 材质尽量可迁移 |
| 能量 | 易「越加越亮」 | 用 D/F/G 与归一约束能量直觉 |

---

## 2. 渲染方程 → 反射方程 `#render-eq`

出射辐亮度 \(L_o(\mathbf{v})\) 是入射 \(L_i(\mathbf{l})\) 经 BRDF \(f_r\) 加权、再乘 \(\cos\theta_l=(\mathbf{n}\cdot\mathbf{l})\) 在半球上积分：

\[
L_o(\mathbf{v})=\int_\Omega f_r(\mathbf{l},\mathbf{v})\,L_i(\mathbf{l})\,(\mathbf{n}\cdot\mathbf{l})\,d\omega_l
\]

实时里常拆：**直接光解析项** + **环境/IBL 近似**。镜面部分用微表面 BRDF \(f_s\)。

---

## 3. 微表面模型 `#microfacet`

宏观法线 \(\mathbf{n}\)；微观小镜面法线统计分布。对镜面反射，有效小面朝向半角：

\[
\mathbf{h}=\mathrm{normalize}(\mathbf{l}+\mathbf{v})
\]

只有法线靠近 \(\mathbf{h}\) 的微面，才能把 \(\mathbf{l}\) 反射到 \(\mathbf{v}\)。

---

## 4. Cook-Torrance `#cook-torrance`

\[
f_s=\frac{D(\mathbf{h})\,F(\mathbf{v},\mathbf{h})\,G(\mathbf{l},\mathbf{v},\mathbf{h})}{4\,(\mathbf{n}\cdot\mathbf{l})\,(\mathbf{n}\cdot\mathbf{v})}
\]

| 符号 | 角色 |
|------|------|
| **D** | 法线分布：多少微面朝向 h |
| **F** | Fresnel：该角度反射多少（其余折射进介质） |
| **G** | 几何遮挡/阴影：微面互相挡住多少 |
| **分母 4(n·l)(n·v)** | 微面 ↔ 宏观量度变换的雅可比/归一，避免重复乘余弦 |

---

## 5. D · GGX `#d-ggx`

GGX（Trowbridge-Reitz）常用：

\[
D=\frac{\alpha^2}{\pi\bigl((\mathbf{n}\cdot\mathbf{h})^2(\alpha^2-1)+1\bigr)^2},\quad \alpha=\mathrm{roughness}^2
\]

粗糙度↑ → 峰变矮变宽 → 高光散、糊。

---

## 6. F · Fresnel / Schlick `#f-fresnel`

Schlick：\(F=F_0+(1-F_0)(1-(\mathbf{h}\cdot\mathbf{v}))^5\)。

- **非金属**：\(F_0\) 常由反射率/IOR 推导，约 0.02–0.08（常见塑料 ~0.04）
- **金属**：\(F_0\) 取 albedo（彩色镜面），无（或极弱）漫反射

---

## 7. G · Smith / Schlick-GGX `#g-smith`

G 描述遮挡与阴影；Smith 形式常写 \(G=G_1(\mathbf{l})G_1(\mathbf{v})\)。Schlick-GGX 用粗糙度相关 \(k\) 做解析近似，避免昂贵积分。

---

## 8. 漫反射 + metallic `#diffuse-metallic`

常见 metallic 工作流：

- `metallic=0`：漫反射用 albedo；镜面 \(F_0\) 用低常数（或 IOR）
- `metallic=1`：漫反射→0；albedo  internally 作 \(F_0\)
- 中间值插值；注意与漫反射项一起做能量直觉上的拆分（\(k_d=(1-F)(1-\mathrm{metallic})\) 一类写法）

---

## 9. 实时实现 `#realtime`

游戏里是 **解析近似**（GGX + Schlick F + Smith-G），不是逐个微面仿真。再配合阴影贴图、IBL 预积分等。

---

## 10. 小结 `#summary`

PBR 镜面核心：微表面统计 × Cook-Torrance \(DFG/4(\mathbf{n}\cdot\mathbf{l})(\mathbf{n}\cdot\mathbf{v})\)；D 管形状、F 管反射比、G 管可见性；metallic 拆漫射与镜面能量。
