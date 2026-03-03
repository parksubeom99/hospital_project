package kr.co.seoulit.his.admin.master.examcatalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExamCatalogRepository extends JpaRepository<ExamCatalogItem, Long> {
    List<ExamCatalogItem> findByCategoryAndActiveOrderByDisplayNameKrAsc(String category, boolean active);
    List<ExamCatalogItem> findByActiveOrderByCategoryAscDisplayNameKrAsc(boolean active);
}
