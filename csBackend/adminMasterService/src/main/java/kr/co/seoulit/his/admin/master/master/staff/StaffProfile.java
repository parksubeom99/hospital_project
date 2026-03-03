package kr.co.seoulit.his.admin.master.master.staff;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "staff_profile")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class StaffProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long staffProfileId;

    @Column(nullable = false, unique = true, length = 50)
    private String loginId; // IAM user subject와 연결

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 50)
    private String jobType; // DOCTOR/NURSE/ADMIN/LAB...

    @Column
    private Long departmentId;

    @Column(nullable = false)
    private boolean active = true;
}
