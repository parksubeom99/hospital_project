package kr.co.seoulit.his.support.execution;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface InjectionExecRepository extends JpaRepository<InjectionExec, Long> {
    Optional<InjectionExec> findByIdempotencyKey(String idempotencyKey);

    List<InjectionExec> findAllByFinalOrderId(Long finalOrderId);
}
