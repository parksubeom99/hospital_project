package kr.co.seoulit.his.admin.frontoffice.queue;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QueueTicketRepository extends JpaRepository<QueueTicket, Long> {
    List<QueueTicket> findByStatus(String status);
    List<QueueTicket> findByVisitId(Long visitId);
}
