# State-action matrix

| Trạng thái | Xem | Sửa | Thanh toán | Biên lai | Hủy/miễn | Khôi phục |
|---|---:|---:|---:|---:|---:|---:|
| UNPAID | Có | Có | Có | Không | Có | Không |
| OVERDUE | Có | Có | Có | Không | Có | Không |
| PAID | Có | Không | Không | Có | Hoàn tiền theo quyền | Không |
| EXEMPTED | Có | Không | Không | Không | Không | Có, nếu đủ điều kiện |
| CANCELLED | Có | Không | Không | Không | Không | Có, nếu đủ điều kiện |

Mọi action tài chính phải disable khi đang submit và backend vẫn là nguồn kiểm tra cuối.
