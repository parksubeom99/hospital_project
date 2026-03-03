package kr.co.seoulit.his.clinical.finalorder;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FinalOrderRepository extends JpaRepository<FinalOrder, Long> {
    Optional<FinalOrder> findByIdempotencyKey(String idempotencyKey);
}
