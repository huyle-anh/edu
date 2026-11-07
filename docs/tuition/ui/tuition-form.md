# Tuition form

Form tạo/sửa dùng MasterSelectField cho học viên/lớp, item fee, discount, scholarship và surcharge; mã học phí được backend tự sinh khi tạo theo kỳ, không cho nhập thủ công. Chỉ lớp `ACTIVE` được đăng ký học viên và tạo học phí; API đăng ký học viên chỉ tạo enrollment; API tạo học phí nhận kỳ `YYYY-MM` bất kỳ trong thời gian lớp và tính theo `ClassSubject.tuitionFee`. Tổng tiền hiển thị tự động theo `original - discount + additional`. Backend tính lại và khóa sửa sau payment SUCCESS.
